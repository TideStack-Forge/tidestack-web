export class Deferred<T> {
  promise: Promise<T>
  resolve!: (value: T | PromiseLike<T>) => void
  reject!: (reason?: any) => void
  state: 'pending' | 'fulfilled' | 'rejected' = 'pending'
  reason?: any
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (value: T) => {
        this.state = 'fulfilled'
        resolve(value)
      }
      this.reject = (reason: any) => {
        this.state = 'rejected'
        this.reason = reason
        reject(reason)
      }
    })
  }
}
