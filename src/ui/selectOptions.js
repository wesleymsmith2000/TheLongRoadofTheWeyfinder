function normalizedDescriptor(descriptor) {
  return {
    value: String(descriptor.value ?? ''),
    label: String(descriptor.label ?? ''),
    dataset: descriptor.dataset ?? {},
  };
}

export function selectOptionsMatch(select, descriptors) {
  const options = Array.from(select?.options ?? []);
  if (options.length !== descriptors.length) return false;

  return descriptors.every((rawDescriptor, index) => {
    const descriptor = normalizedDescriptor(rawDescriptor);
    const option = options[index];
    const datasetEntries = Object.entries(descriptor.dataset);
    return option.value === descriptor.value
      && option.textContent === descriptor.label
      && Object.keys(option.dataset ?? {}).length === datasetEntries.length
      && datasetEntries.every(([key, value]) => option.dataset[key] === String(value));
  });
}

export function reconcileSelectOptions(select, descriptors, preferredValue = select?.value ?? '') {
  const normalized = descriptors.map(normalizedDescriptor);
  const selectedValue = normalized.some((descriptor) => descriptor.value === preferredValue)
    ? preferredValue
    : normalized[0]?.value ?? '';

  if (selectOptionsMatch(select, normalized)) {
    if (select.value !== selectedValue) select.value = selectedValue;
    return false;
  }

  const documentRef = select.ownerDocument ?? globalThis.document;
  const options = normalized.map((descriptor) => {
    const option = documentRef.createElement('option');
    option.value = descriptor.value;
    option.textContent = descriptor.label;
    for (const [key, value] of Object.entries(descriptor.dataset)) option.dataset[key] = String(value);
    return option;
  });
  select.replaceChildren(...options);
  select.value = selectedValue;
  return true;
}
