export function maskPhone(phone: string | null | undefined) {
  const value = phone?.trim() ?? "";
  if (!value) return null;
  if (!/^1\d{10}$/u.test(value)) return value;
  return `${value.slice(0, 3)}xxxxx${value.slice(-3)}`;
}
