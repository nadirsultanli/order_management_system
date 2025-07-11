// Fix: Declare window as undefined to prevent @trpc/server from trying to access it in Node.js
declare global {
  const window: undefined;
}

export {};