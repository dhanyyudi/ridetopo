declare global {
  interface Navigator {
    canShare(data?: ShareData): boolean;
  }
}

export {};
