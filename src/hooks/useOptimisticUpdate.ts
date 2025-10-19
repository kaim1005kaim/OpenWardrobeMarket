import { useState, useCallback } from 'react';

export interface OptimisticState<T> {
  data: T;
  isPending: boolean;
  error: Error | null;
}

/**
 * 楽観的UI更新のためのhook
 * APIレスポンスを待たずにUIを即座に更新し、エラー時にロールバック
 */
export function useOptimisticUpdate<T>(
  initialData: T
): [
  OptimisticState<T>,
  (
    optimisticValue: T,
    asyncFn: () => Promise<T>
  ) => Promise<void>
] {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    isPending: false,
    error: null,
  });

  const performUpdate = useCallback(
    async (optimisticValue: T, asyncFn: () => Promise<T>) => {
      // 現在の値を保存（ロールバック用）
      const previousData = state.data;

      // 即座にUIを更新（楽観的）
      setState({
        data: optimisticValue,
        isPending: true,
        error: null,
      });

      try {
        // バックエンド処理を実行
        const result = await asyncFn();

        // 成功したら確定値で更新
        setState({
          data: result,
          isPending: false,
          error: null,
        });
      } catch (error) {
        // エラー時は元に戻す（ロールバック）
        setState({
          data: previousData,
          isPending: false,
          error: error instanceof Error ? error : new Error('Unknown error'),
        });
        throw error;
      }
    },
    [state.data]
  );

  return [state, performUpdate];
}
