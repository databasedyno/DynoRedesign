const arraySorting = (tempData: Array<Record<string, unknown>>, keyName: string, asc = true) => {
  tempData.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    if (a[keyName] < b[keyName]) {
      return asc ? -1 : 1;
    }
    if (a[keyName] > b[keyName]) {
      return asc ? 1 : -1;
    }
    return 0;
  });
  return tempData;
};

export default arraySorting;
