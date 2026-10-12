export function formatPrice(amount: number) {
  return `£${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function formatCount(count: number) {
  return count.toLocaleString("en-GB");
}

export function unsplash(id: string, width: number) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
}
