type Task = () => Promise<any>;

class Deffered<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  promise: Promise<T>;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export class ThreadPool {
  concurrency: number;
  running: number;
  queue: Array<Task>;
  completion: Deffered<void> | null;

  constructor(concurrency: number) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.completion = null;
  }

  private runNextTask() {
    if (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.running++;
        task().finally(() => {
          this.running--;
          this.runNextTask();
        });
      }
    }

    if (this.running === 0 && this.queue.length === 0 && this.completion) {
      this.completion.resolve();
    }
  }

  execute(task: Task) {
    this.queue.push(task);
    this.runNextTask();
  }

  async wait() {
    if (this.queue.length === 0) {
      return;
    }

    this.completion = new Deffered<void>();
    await this.completion.promise;
  }
}
