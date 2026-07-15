export const sanitizeItem = (item: any) => {
  const { password, createdAt, updatedAt, __v, ...clean } = item;
  return clean;
};
