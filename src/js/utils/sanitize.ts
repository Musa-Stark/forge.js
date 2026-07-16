export const sanitizeOne = (item: any) => {
  const { password, createdAt, updatedAt, __v, ...clean } = item;
  return clean;
};

export const sanitizeMany = (items: any) => {
  let cleaned: any[] = [];

  items.map((el: any) => {
    const { password, createdAt, updatedAt, __v, ...clean } = el.toObject();
    cleaned.push(clean);
  });

  return cleaned;
};
