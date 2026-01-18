/**
 * Customer Plugin - Data Types
 * 
 * 顧客管理プラグインのデータ型定義
 */

/**
 * 支払タイプ
 * - credit: 掛売上（締め日に請求）
 * - cash: 現金売上（都度請求）
 */
export type PaymentType = 'credit' | 'cash';

/**
 * 顧客データ
 */
export interface Customer {
    id: string;

    // 基本情報
    name: string;              // 顧客名（個人名 or 会社名）
    nameKana?: string;         // フリガナ
    address?: string;          // 住所
    phone?: string;            // 電話番号
    email?: string;            // メールアドレス

    // 請求設定（デフォルト）
    closingDay?: number;       // 締め日（1-31、0=月末）
    paymentType: PaymentType;  // 掛売上 or 現金売上
    carryOver?: number;        // 繰越金額

    // メタデータ
    memo?: string;             // メモ
    createdAt: number;
    updatedAt: number;
}

/**
 * 顧客作成リクエスト
 */
export type CustomerCreateRequest = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 顧客更新リクエスト
 */
export type CustomerUpdateRequest = Partial<CustomerCreateRequest>;

/**
 * 顧客検索オプション
 */
export interface CustomerSearchOptions {
    query?: string;            // 名前・フリガナで検索
    paymentType?: PaymentType; // 支払タイプでフィルタ
    limit?: number;
    offset?: number;
}
