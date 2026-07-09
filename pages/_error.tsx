import React, { useEffect } from "react";
import NoAccess from "@/assets/Images/404.png";
import { Box, Button, Typography } from "@mui/material";
import { useRouter } from "next/router";
import Image from "next/image";

const Error = ({ statusCode, setPageName }: any) => {
  const router = useRouter();
  useEffect(() => {
    if (setPageName) {
      setPageName("");
    }
  }, [setPageName]);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100dvh",
        width: "100%",
        flexDirection: "column",
        "& img": {
          width: "min(400px, 80vw)",
        },
        "& h5": {
          mt: 2,
          fontWeight: 700,
          textAlign: "center",
        },
      }}
    >
      <Image src={NoAccess} alt="No Access" height={200} width={200} draggable={false} style={{ objectFit: "contain" }} />
      <Typography color="primary" variant="h5" fontFamily="var(--font-sans)" fontSize="24px" lineHeight="32px" letterSpacing="0.01em" textTransform="none" maxWidth="500px">
        {statusCode === 404
          ? "The page you are looking for was not found or is unavailable"
          : statusCode
            ? `An error ${statusCode} occurred on server`
            : "An error occurred on client"}{" "}
        ⛔
      </Typography>
      <Box
        sx={{
          mt: 3,
          "& button": {
            mx: 2,
          },
        }}
      >
        <Button
          variant="rounded"
          sx={{
            background: (theme) => theme.palette.mode === "dark" ? theme.palette.primary.main : "#12131C",
            color: "#fff",
            "&:hover": {
              color: (theme) => theme.palette.mode === "dark" ? "#fff" : "#12131C",
              background: (theme) => theme.palette.mode === "dark" ? "#5A6BEF" : "transparent",
            },
            fontFamily: "var(--font-sans)",
            fontSize: "16px",
            lineHeight: "24px",
            letterSpacing: "0.01em",
            textTransform: "none",
          }}
          onClick={() => router.back()}
          disableRipple={false}
        >
          Go back
        </Button>
      </Box>
    </Box>
  );
};

Error.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

Error.layout = "none";

export default Error;
