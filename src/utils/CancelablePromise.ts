export class CancelablePromise<T> {
  promise: Promise<T>
  next?: CancelablePromise<T>
  private hasCanceled = false

  constructor (promise: Promise<T>) {
    this.promise = new Promise<T>((resolve, reject) => {
      promise.then(
        val => (this.hasCanceled ? reject({ isCanceled: true }) : resolve(val)),
        error => (this.hasCanceled ? reject({ isCanceled: true }) : reject(error))
      )
    })
  }

  cancel () {
    this.hasCanceled = true
    if (this.next) {
      this.next.cancel()
    }
  }

  chain (mapper: (t: T) => Promise<T>): CancelablePromise<T> {
    let last: CancelablePromise<T> = this
    while (last.next) {
      last = last.next
    }
    last.next = new CancelablePromise<T>(this.promise.then(t => (this.hasCanceled ? t : mapper(t))))
    this.promise = last.next.promise
    return last.next
  }
}

export const makeCancelablePromise = <T>(promise: Promise<T>): CancelablePromise<T> => new CancelablePromise(promise)
