const getErrorMessage = (e: unknown): string => {
  const error = e as {
    response?: {
      data?: {
        error?: { message?: string };
        message?: string;
      };
    };
    message?: string;
  };
  
  return (
    error?.response?.data?.error?.message ??
    error?.response?.data?.message ??
    error?.message ??
    "Internal Server Error"
  );
};

export default getErrorMessage;
