/**
 * R-034 Phase 2: Google カレンダー予定の表示用型定義。
 *
 * バックエンド API（`GET /api/calendar/grid` の `external_events`、または
 * `GET /api/google/calendar/events`）から返るレコードのフロント側表現。
 * 値は snake_case → camelCase へリポジトリ層で変換した想定。
 */
export type ExternalEvent = {
    id: string;
    calendarId: string;
    eventId: string;
    /** 開始時刻 (unix 秒) */
    startAt: number;
    /** 終了時刻 (unix 秒) */
    endAt: number;
    allDay: boolean;
    title: string | null;
    location: string | null;
    /** Google カレンダー上のイベントリンク（任意） */
    htmlLink?: string | null;
};

/** 終日イベントの量感換算デフォルト値（分） */
export const DEFAULT_ALL_DAY_WEIGHT_MINUTES = 240;
