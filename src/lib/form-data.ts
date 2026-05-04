export function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export function nullableUuid(value: FormDataEntryValue | null) {
  const text = value?.toString();
  return text ? text : null;
}
