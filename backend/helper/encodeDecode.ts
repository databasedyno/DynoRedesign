const encodeDecode = (encode = true, value: unknown) => {
  const returnValue = encode
    ? Buffer.from(value.toString()).toString("base64")
    : Buffer.from(value.toString(), "base64").toString("ascii");
  return returnValue;
};

export default encodeDecode;
