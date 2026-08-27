<?php
// backend/services/BeaverCapacityService.php
// R-153: 負荷モデル（docs/SPEC/07_Beaver連携.md §6）とEDF仮想充当シミュレーション（§7）
//
// 設計方針:
//   - 二重計上しない: effective_total = max(baseline, 分解済み合計)
//   - 日付未配置の仕事量（仮想残量＋日付なしタスク）も消さない
//   - 読み取り専用。結果は保存しない（毎回計算）
//   - 日付・時刻はJST（Asia/Tokyo）基準
//   - 会社日次キャパはフロント QuantityEngine.calculateTeamCapacityForDate のテナント集計と同一規則
//     （共有フィクスチャ tests/fixtures/company_capacity_cases.json で数値一致を担保）

require_once __DIR__ . '/../QuantityService.php';

class BeaverCapacityService {
    public const HORIZON_DAYS = 365;
    // ponytail: フロント allocateBackwardsCore と同じ120日で打ち切り（超過分は切り捨て）
    public const BACKWARD_SAFETY_DAYS = 120;

    private PDO $pdo;
    private string $tenantId;
    private array $excludedStatuses;
    private DateTimeZone $tz;
    private string $today; // Y-m-d（JST）

    public function __construct(PDO $pdo, string $tenantId, array $excludedStatuses, ?string $today = null) {
        $this->pdo = $pdo;
        $this->tenantId = $tenantId;
        $this->excludedStatuses = $excludedStatuses;
        $this->tz = new DateTimeZone('Asia/Tokyo');
        $this->today = $today ?: (new DateTime('now', $this->tz))->format('Y-m-d');
    }

    /**
     * 会社日次キャパ: is_core=1 メンバーの capacity_profile／daily_capacity_minutes を日別に合計。
     * フロント QuantityEngine.calculateTeamCapacityForDate / calculateMemberTeamCapacityForDate と同一規則。
     * 優先順（メンバーごと）:
     * 1. profile.dailyCompanyExceptions[日付][tenantId]
     * 2. profile.defaultCompanyWeeklyPattern[曜日][tenantId]
     * 3. profile.exceptions[日付]
     * 4. profile.standardWeeklyPattern[曜日]
     * 5. daily_capacity_minutes
     * 会社スコープの休日（getDailyCapacityFromConfigで0になる日）は合計前に0短絡する。
     *
     * @param array $members memberships行相当: [is_core, daily_capacity_minutes, capacity_profile(JSON文字列|配列|null)]
     * @param array $capacityConfig QuantityService::getDailyCapacityFromConfig と同じsnake_case形
     */
    public static function calcCompanyDailyCapacity(DateTime $date, array $members, array $capacityConfig, ?string $tenantId): int {
        $qs = new QuantityService(null);
        if ($qs->getDailyCapacityFromConfig($date, $capacityConfig) === 0) {
            return 0;
        }

        $dateKey = $date->format('Y-m-d');
        $dayIndex = (int)$date->format('w'); // 0=Sun ... 6=Sat
        $total = 0;
        foreach ($members as $m) {
            if (empty($m['is_core'])) continue;
            $profile = $m['capacity_profile'] ?? null;
            if (is_string($profile)) {
                $profile = json_decode($profile, true);
            }
            $v = null;
            if (is_array($profile)) {
                if ($tenantId !== null) {
                    if (isset($profile['dailyCompanyExceptions'][$dateKey]) && array_key_exists($tenantId, $profile['dailyCompanyExceptions'][$dateKey])) {
                        $v = $profile['dailyCompanyExceptions'][$dateKey][$tenantId];
                    } elseif (isset($profile['defaultCompanyWeeklyPattern'][$dayIndex]) && array_key_exists($tenantId, $profile['defaultCompanyWeeklyPattern'][$dayIndex])) {
                        $v = $profile['defaultCompanyWeeklyPattern'][$dayIndex][$tenantId];
                    }
                }
                if ($v === null && isset($profile['exceptions']) && array_key_exists($dateKey, $profile['exceptions'])) {
                    $v = $profile['exceptions'][$dateKey];
                }
                if ($v === null && isset($profile['standardWeeklyPattern']) && array_key_exists($dayIndex, $profile['standardWeeklyPattern'])) {
                    $v = $profile['standardWeeklyPattern'][$dayIndex];
                }
            }
            if ($v === null) {
                $v = $m['daily_capacity_minutes'] ?? 0;
            }
            $total += max(0, (int)$v);
        }
        return $total;
    }

    /**
     * §8 GET /integrations/beaver/overview の本体。
     * 全リンク＋§6の負荷値＋§7の判定結果＋同期状態を返す。
     */
    public function buildOverview(): array {
        $links = $this->fetchLinks();
        $items = $this->fetchItems();
        $loads = $this->computeLinkLoads($links, $items);
        $checks = $this->simulate($links, $items, $loads);

        $rows = [];
        foreach ($links as $link) {
            $ext = (int)$link['external_project_id'];
            $rows[] = [
                'external_project_id' => $ext,
                'youkan_project_id' => $link['youkan_project_id'],
                'source_name' => $link['source_name'],
                'source_code' => $link['source_code'],
                'source_customer_name' => $link['source_customer_name'],
                'source_status' => $link['source_status'],
                'source_delivery_date' => $link['source_delivery_date'],
                'baseline_minutes' => $link['baseline_minutes'] !== null ? (int)$link['baseline_minutes'] : null,
                'baseline_source' => $link['baseline_source'],
                'sync_state' => $link['sync_state'],
                'load' => $loads[$ext]['load'],
                'work_packages' => $loads[$ext]['work_packages'] ?? [],
                'check' => $checks[$ext],
            ];
        }

        $stmt = $this->pdo->prepare("SELECT last_synced_at, last_error FROM external_sync_state WHERE tenant_id = ? AND source_system = 'beaver'");
        $stmt->execute([$this->tenantId]);
        $state = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'links' => $rows,
            'last_synced_at' => isset($state['last_synced_at']) && $state['last_synced_at'] !== null ? (int)$state['last_synced_at'] : null,
            'last_error' => $state['last_error'] ?? null,
        ];
    }

    /** 単一案件の判定（capacity-check用）。リンクがなければnull */
    public function checkProject(int $externalProjectId): ?array {
        $links = $this->fetchLinks();
        $found = false;
        foreach ($links as $link) {
            if ((int)$link['external_project_id'] === $externalProjectId) { $found = true; break; }
        }
        if (!$found) return null;
        $items = $this->fetchItems();
        $loads = $this->computeLinkLoads($links, $items);
        $checks = $this->simulate($links, $items, $loads);
        return $checks[$externalProjectId] ?? null;
    }

    // ---- 内部実装 ----

    private function fetchLinks(): array {
        $stmt = $this->pdo->prepare("SELECT * FROM external_project_links WHERE tenant_id = ? AND source_system = 'beaver' ORDER BY CAST(external_project_id AS INTEGER)");
        $stmt->execute([$this->tenantId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function fetchItems(): array {
        $stmt = $this->pdo->prepare("SELECT id, parent_id, project_id, is_project, status, estimated_minutes, due_date, prep_date, deleted_at, is_archived, work_days FROM items WHERE tenant_id = ?");
        $stmt->execute([$this->tenantId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /** R-154 (Y2) §4.1: このテナントのwork_packageリンク一覧 */
    private function fetchWorkPackageLinks(): array {
        $stmt = $this->pdo->prepare("SELECT * FROM external_work_package_links WHERE tenant_id = ?");
        $stmt->execute([$this->tenantId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * items配列から「id => 直接の子idリスト」を構築する。
     * 子の登録は parent_id を優先し、parent_id が空（または未知のid）のときのみ project_id にフォールバックする
     * （frontend hierarchy.ts の areIdsMatching(parentId,...) || (!parentId && areIdsMatching(projectId,...)) と同じ規則）。
     * 両方を無条件に登録すると、3階層以上のネストで project_id がルート案件を指す通常アイテムが
     * 「ルート直下の子」と「真の親の子」の2箇所に登録され、再帰合計（computeNode）で二重計上になる
     * （R-153/R-154実機検証で発覚。descendantIds側は visited による Set化で実害が出ないが、
     * computeNode は素通しの再帰合計のため露呈する。ここを直せば両者とも安全になる）。
     */
    private function buildChildrenOf(array $items): array {
        $byId = [];
        foreach ($items as $it) $byId[$it['id']] = true;
        $childrenOf = [];
        foreach ($items as $it) {
            $pid = $it['parent_id'] ?? null;
            if (!empty($pid) && isset($byId[$pid])) {
                $childrenOf[$pid][] = $it['id'];
            } elseif (!empty($it['project_id'])) {
                $childrenOf[$it['project_id']][] = $it['id'];
            }
        }
        return $childrenOf;
    }

    /** プロジェクト配下（project_id / parent_id 連鎖）の全子孫ID集合 */
    private function descendantIds(string $projectId, array $items): array {
        $childrenOf = $this->buildChildrenOf($items);
        $result = [];
        $queue = [$projectId];
        $visited = [$projectId => true];
        while ($queue) {
            $cur = array_shift($queue);
            foreach ($childrenOf[$cur] ?? [] as $childId) {
                if (isset($visited[$childId])) continue;
                $visited[$childId] = true;
                $result[$childId] = true;
                $queue[] = $childId;
            }
        }
        return $result;
    }

    /** 末端ノードの除外条件（§6.1）: 削除・アーカイブ・is_project=1・cancelled/someday */
    private function isExcludedLeafItem(array $it): bool {
        if (!empty($it['deleted_at']) || !empty($it['is_archived']) || !empty($it['is_project'])) return true;
        if (in_array($it['status'], ['cancelled', 'someday'], true)) return true;
        return false;
    }

    /**
     * R-154 (Y2) §6.2: 案件→work_package→子タスクの任意深さツリーへの再帰計算。
     * work_packagesが存在しない案件では、この再帰計算はY1の2階層ロジックと数学的に同一の結果を返す
     * （baselineなし中間ノードはchildren_sumをそのまま通すため、Y1のフラット合計に一致する）。
     * @param string|null $id 対象ノードのitem id
     * @param bool $isRoot 案件ノード（root）かどうか
     * @param int|null $rootBaseline root時のみ使用するbaseline（除外ステータス調整済み）
     * @param bool $excludedProject 案件が除外ステータスなら true。Beaver由来のbaseline（root・work_package双方）を
     *   0扱いにする（Y1の「消えるのはBeaver由来の基準負荷だけ」をwork_package層へ継承。実際に分解済みの
     *   子タスクの負荷はexcluded=trueでも通常どおり残る）
     * @return array{effective_total:int, completed:int, placed:int, children_sum:int}
     */
    private function computeNode(?string $id, bool $isRoot, ?int $rootBaseline, array $byId, array $childrenOf, array $wpLinkByItemId, bool $excludedProject = false): array {
        $isWp = !$isRoot && $id !== null && isset($wpLinkByItemId[$id]);
        $isBaselineNode = $isRoot || $isWp;
        $baseline = $isRoot ? $rootBaseline : ($isWp ? ($excludedProject ? 0 : (int)$wpLinkByItemId[$id]['baseline_minutes']) : null);
        $children = $id !== null ? ($childrenOf[$id] ?? []) : [];

        if (!$isBaselineNode && empty($children)) {
            // 末端ノード（leaf）
            $it = $id !== null ? ($byId[$id] ?? null) : null;
            if (!$it || $this->isExcludedLeafItem($it)) {
                return ['effective_total' => 0, 'completed' => 0, 'placed' => 0, 'children_sum' => 0];
            }
            $est = (int)($it['estimated_minutes'] ?? 0);
            $completed = $it['status'] === 'done' ? $est : 0;
            $placed = ($it['status'] !== 'done' && (!empty($it['prep_date']) || !empty($it['due_date']))) ? $est : 0;
            return ['effective_total' => $est, 'completed' => $completed, 'placed' => $placed, 'children_sum' => 0];
        }

        $childSum = 0;
        $completed = 0;
        $placed = 0;
        foreach ($children as $cid) {
            $c = $this->computeNode($cid, false, null, $byId, $childrenOf, $wpLinkByItemId, $excludedProject);
            $childSum += $c['effective_total'];
            $completed += $c['completed'];
            $placed += $c['placed'];
        }
        $effective = $isBaselineNode ? max($baseline, $childSum) : $childSum;
        return ['effective_total' => $effective, 'completed' => $completed, 'placed' => $placed, 'children_sum' => $childSum];
    }

    /**
     * §6 負荷モデル。リンクごとに baseline / decomposed / effective_total / completed /
     * remaining / placed / unplaced と締切を求める（R-154よりwork_package層を含む再帰計算）。
     * §10: overview応答用に各案件のwork_packages配列（decomposed/effective_total/virtual_residual/overage）も返す。
     * @return array ext_id(int) => ['load' => [...], 'work_packages' => [...], 'deadline' => ?string, 'descendants' => array]
     */
    private function computeLinkLoads(array $links, array $items): array {
        $byId = [];
        foreach ($items as $it) $byId[$it['id']] = $it;
        $childrenOf = $this->buildChildrenOf($items);

        $wpLinks = $this->fetchWorkPackageLinks();
        $wpLinkByItemId = [];
        $wpLinksByExtProject = [];
        foreach ($wpLinks as $wl) {
            $wpLinkByItemId[$wl['youkan_item_id']] = $wl;
            $wpLinksByExtProject[$wl['external_project_id']][] = $wl;
        }

        $result = [];
        foreach ($links as $link) {
            $ext = (int)$link['external_project_id'];
            $descendants = $this->descendantIds($link['youkan_project_id'], $items);

            $excludedProject = $this->isExcludedStatus($link['source_status']);
            $baseline = $excludedProject ? 0 : (int)($link['baseline_minutes'] ?? 0);
            $root = $this->computeNode($link['youkan_project_id'], true, $baseline, $byId, $childrenOf, $wpLinkByItemId, $excludedProject);
            $decomposed = $root['children_sum'];
            $effective = $root['effective_total'];
            $completed = $root['completed'];
            $remaining = max(0, $effective - $completed);
            $placed = $root['placed'];
            $unplaced = max(0, $remaining - $placed);

            $deadline = $link['source_delivery_date'] ?: null;
            if ($deadline === null) {
                $proj = $byId[$link['youkan_project_id']] ?? null;
                $deadline = ($proj && !empty($proj['due_date'])) ? $proj['due_date'] : null;
            }

            $workPackages = [];
            foreach ($wpLinksByExtProject[$link['external_project_id']] ?? [] as $wl) {
                $wpRes = $this->computeNode($wl['youkan_item_id'], false, null, $byId, $childrenOf, $wpLinkByItemId, $excludedProject);
                $wpBaseline = (int)$wl['baseline_minutes']; // 表示用（root同様、生値。除外調整はeffective系のみに適用）
                $wpBaselineForCalc = $excludedProject ? 0 : $wpBaseline;
                $wpDecomposed = $wpRes['children_sum'];
                $wpEffective = $wpRes['effective_total'];
                $workPackages[] = [
                    'external_work_package_id' => $wl['external_work_package_id'],
                    'youkan_item_id' => $wl['youkan_item_id'],
                    'label' => $wl['label'],
                    'category' => $wl['category'],
                    'baseline_minutes' => $wpBaseline,
                    'decomposed_minutes' => $wpDecomposed,
                    'effective_total_minutes' => $wpEffective,
                    'virtual_residual_minutes' => max(0, $wpBaselineForCalc - $wpDecomposed),
                    'overage_minutes' => max(0, $wpDecomposed - $wpBaselineForCalc),
                    'sync_state' => $wl['sync_state'],
                ];
            }

            $result[$ext] = [
                'load' => [
                    'baseline' => $baseline,
                    'decomposed' => $decomposed,
                    'effective_total' => $effective,
                    'completed' => $completed,
                    'remaining' => $remaining,
                    'placed' => $placed,
                    'unplaced' => $unplaced,
                ],
                'work_packages' => $workPackages,
                'deadline' => $deadline,
                'descendants' => $descendants,
            ];
        }
        return $result;
    }

    private function isExcludedStatus(?string $status): bool {
        return $status !== null && in_array($status, $this->excludedStatuses, true);
    }

    private function loadCoreMembers(): array {
        $stmt = $this->pdo->prepare("SELECT is_core, daily_capacity_minutes, capacity_profile FROM memberships WHERE tenant_id = ? AND is_core = 1");
        $stmt->execute([$this->tenantId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /** 会社スコープの休日判定に使う既定コンフィグ（平日480・土日0。式は getDailyCapacityFromConfig に一本化） */
    private function companyConfig(): array {
        return ['default_daily_minutes' => 480, 'holidays' => [], 'exceptions' => [], 'standard_weekly_pattern' => null];
    }

    /**
     * §7.1 配置済み負荷: 未完了・日付ありアイテムを prep_date||due_date 終端の後ろ向き配分で日別合計。
     * 過去日に配分された分は今日に繰り越す。QuantityEngine.allocateBackwardsCore と同一規則。
     * @return array 'Y-m-d' => minutes
     */
    private function buildPlacedLoadMap(array $items, callable $capacityForDate): array {
        $map = [];
        foreach ($items as $it) {
            if (!empty($it['deleted_at']) || !empty($it['is_archived']) || !empty($it['is_project'])) continue;
            if (in_array($it['status'], ['done', 'cancelled', 'someday'], true)) continue;
            $endDate = $this->itemEndDate($it);
            if ($endDate === null) continue;

            $est = (int)($it['estimated_minutes'] ?? 0);
            $minutes = $est ?: ((float)($it['work_days'] ?? 0) > 0 ? (int)round((float)$it['work_days'] * 480) : 60);

            $cur = new DateTime($endDate, $this->tz);
            $remaining = $minutes;
            $safety = 0;
            while ($remaining > 0 && $safety < self::BACKWARD_SAFETY_DAYS) {
                $safety++;
                $cap = $capacityForDate($cur);
                if ($cap <= 0) {
                    $cur->modify('-1 day');
                    continue;
                }
                $alloc = min($remaining, $cap);
                $key = $cur->format('Y-m-d');
                if (strcmp($key, $this->today) < 0) {
                    $key = $this->today; // 過去分の繰り越し
                }
                $map[$key] = ($map[$key] ?? 0) + $alloc;
                $remaining -= $alloc;
                $cur->modify('-1 day');
            }
        }
        return $map;
    }

    private function itemEndDate(array $it): ?string {
        if (!empty($it['prep_date'])) {
            return (new DateTime('@' . (int)$it['prep_date']))->setTimezone($this->tz)->format('Y-m-d');
        }
        if (!empty($it['due_date'])) {
            return $it['due_date'];
        }
        return null;
    }

    /**
     * §7.2 EDF仮想充当。未配置プール（各リンクのunplaced＋日付なし通常アイテム）を
     * 締切昇順で今日から前方詰めし、案件ごとの判定を返す。
     * @return array ext_id(int) => §7.3 の出力
     */
    private function simulate(array $links, array $items, array $loads): array {
        $members = $this->loadCoreMembers();
        $config = $this->companyConfig();
        $capCache = [];
        $capacityForDate = function (DateTime $d) use ($members, $config, &$capCache): int {
            $key = $d->format('Y-m-d');
            if (!isset($capCache[$key])) {
                $capCache[$key] = self::calcCompanyDailyCapacity($d, $members, $config, $this->tenantId);
            }
            return $capCache[$key];
        };

        $placedMap = $this->buildPlacedLoadMap($items, $capacityForDate);

        // 地平線（今日から365日）の日付リストと空き容量
        $dates = [];
        $freeRem = [];
        $cur = new DateTime($this->today, $this->tz);
        for ($i = 0; $i <= self::HORIZON_DAYS; $i++) {
            $key = $cur->format('Y-m-d');
            $dates[$i] = $key;
            $freeRem[$i] = max(0, $capacityForDate($cur) - ($placedMap[$key] ?? 0));
            $cur->modify('+1 day');
        }

        // 未配置プール: リンクのunplaced（締切あり優先）＋日付なし通常アイテム（締切なし・リンク配下は二重に入れない）
        $pool = [];
        foreach ($links as $link) {
            $ext = (int)$link['external_project_id'];
            $pool[] = [
                'ext' => $ext,
                'minutes' => $loads[$ext]['load']['unplaced'],
                'deadline' => $loads[$ext]['deadline'],
                'generic' => false,
            ];
        }
        $linkedIds = [];
        foreach ($loads as $l) {
            foreach ($l['descendants'] as $id => $_) $linkedIds[$id] = true;
        }
        $genericMinutes = 0;
        foreach ($items as $it) {
            if (!empty($it['deleted_at']) || !empty($it['is_archived']) || !empty($it['is_project'])) continue;
            if (in_array($it['status'], ['done', 'cancelled', 'someday', 'pending'], true)) continue;
            if ($this->itemEndDate($it) !== null) continue;
            if ((int)($it['estimated_minutes'] ?? 0) <= 0) continue;
            if (isset($linkedIds[$it['id']])) continue;
            $genericMinutes += (int)$it['estimated_minutes'];
        }
        if ($genericMinutes > 0) {
            $pool[] = ['ext' => null, 'minutes' => $genericMinutes, 'deadline' => null, 'generic' => true];
        }

        usort($pool, function ($a, $b) {
            if (($a['deadline'] === null) !== ($b['deadline'] === null)) return $a['deadline'] === null ? 1 : -1;
            if ($a['deadline'] !== null && $a['deadline'] !== $b['deadline']) return strcmp($a['deadline'], $b['deadline']);
            if ($a['generic'] !== $b['generic']) return $a['generic'] ? 1 : -1;
            return ($a['ext'] ?? PHP_INT_MAX) <=> ($b['ext'] ?? PHP_INT_MAX);
        });

        // 前方詰め充当と案件ごとの判定
        $results = [];
        foreach ($pool as $entry) {
            $need = $entry['minutes'];
            $deadline = $entry['deadline'];
            $allocByDeadline = 0;
            $completionDate = $need === 0 ? $this->today : null;
            for ($i = 0; $i <= self::HORIZON_DAYS && $need > 0; $i++) {
                if ($freeRem[$i] <= 0) continue;
                $take = min($need, $freeRem[$i]);
                $freeRem[$i] -= $take;
                $need -= $take;
                if ($deadline !== null && strcmp($dates[$i], $deadline) <= 0) {
                    $allocByDeadline += $take;
                }
                if ($need === 0) {
                    $completionDate = $dates[$i];
                }
            }

            if ($entry['generic']) continue; // 通常アイテムは容量だけ消費し、結果は返さない

            $ext = $entry['ext'];
            $load = $loads[$ext]['load'];
            $shortage = $deadline === null ? 0 : $entry['minutes'] - $allocByDeadline;
            $feasible = $deadline !== null && $shortage === 0;

            // この案件までの充当で空きが尽きている最終日（今日から連続して空き0の日）
            $saturatedThrough = null;
            for ($i = 0; $i <= self::HORIZON_DAYS; $i++) {
                if ($freeRem[$i] > 0) break;
                $saturatedThrough = $dates[$i];
            }

            $results[$ext] = [
                'external_project_id' => $ext,
                'feasible' => $feasible,
                'deadline' => $deadline,
                'required_minutes' => $load['remaining'],
                'placed_minutes' => $load['placed'],
                'unplaced_minutes' => $load['unplaced'],
                'shortage_minutes' => $shortage,
                'earliest_completion_date' => $completionDate,
                'saturated_through' => $saturatedThrough,
                'message' => $this->buildMessage($feasible, $deadline, $load['remaining'], $shortage, $completionDate),
            ];
        }
        return $results;
    }

    /** §7.3 結論優先の日本語1行 */
    private function buildMessage(bool $feasible, ?string $deadline, int $remaining, int $shortage, ?string $completionDate): string {
        if ($deadline === null) {
            return '納期未設定・残り' . $this->formatHours($remaining) . 'h';
        }
        if ($feasible) {
            return '入ります';
        }
        $base = $this->formatMd($deadline) . '納期では' . $this->formatHours($shortage) . 'h不足';
        return $completionDate !== null
            ? $base . '（' . $this->formatMd($completionDate) . 'なら入る）'
            : $base . '（365日以内に完了見込みなし）';
    }

    private function formatHours(int $minutes): string {
        $h = round($minutes / 60, 1);
        return rtrim(rtrim(number_format($h, 1, '.', ''), '0'), '.');
    }

    private function formatMd(string $ymd): string {
        $d = new DateTime($ymd, $this->tz);
        return (int)$d->format('n') . '/' . (int)$d->format('j');
    }
}
