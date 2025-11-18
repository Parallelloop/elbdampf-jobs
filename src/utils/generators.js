const clean = (val) => {
  if (!val || val === "null" || val === null || val === undefined) return "";
  return String(val).trim();
};

export {
    clean
}