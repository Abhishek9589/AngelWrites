export function retryImport<T>(factory: () => Promise<T>, retries = 2, intervalMs = 400): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (n: number) => {
      factory()
        .then(resolve)
        .catch((err) => {
          if (n <= 0) {
            reject(err);
            return;
          }
          setTimeout(() => attempt(n - 1), intervalMs);
        });
    };
    attempt(retries);
  });
}
