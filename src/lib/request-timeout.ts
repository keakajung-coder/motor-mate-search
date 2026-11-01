/** Bound UI waits even when an RPC never settles; late results are ignored. */
export function withRequestTimeout<T>(request: PromiseLike<T>, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่")), timeoutMs);
    Promise.resolve(request).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}