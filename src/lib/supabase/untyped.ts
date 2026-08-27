type SupabaseErrorLike = { message: string } | null;

export type UntypedRecord = Record<string, unknown>;

export type UntypedQueryResult<T = UntypedRecord> = Promise<{
  data: T | null;
  error: SupabaseErrorLike;
}>;

export type UntypedQueryListResult<T = UntypedRecord> = Promise<{
  data: T[] | null;
  error: SupabaseErrorLike;
}>;

export type UntypedQueryBuilder<T = UntypedRecord> = {
  select(columns?: string): UntypedQueryBuilder<T>;
  eq(column: string, value: unknown): UntypedQueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): UntypedQueryBuilder<T>;
  limit(count: number): UntypedQueryBuilder<T>;
  insert(payload: unknown): UntypedQueryBuilder<T>;
  upsert(payload: unknown, options?: { onConflict?: string }): UntypedQueryBuilder<T>;
  update(payload: unknown): UntypedQueryBuilder<T>;
  single(): UntypedQueryResult<T>;
  maybeSingle(): UntypedQueryResult<T>;
  then<TResult1 = { data: T[] | null; error: SupabaseErrorLike }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[] | null; error: SupabaseErrorLike }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

export type UntypedSupabase = {
  from<T = UntypedRecord>(table: string): UntypedQueryBuilder<T>;
  rpc<T = unknown>(
    functionName: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: T | null; error: SupabaseErrorLike }>;
};

export function asUntypedSupabase(client: unknown): UntypedSupabase {
  return client as UntypedSupabase;
}
