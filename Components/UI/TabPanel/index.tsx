import { Box } from "@mui/material";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
  py?: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, py, ...other } = props;

  return (
    <div
      role="tabpanel"
      className="tabPanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: py ?? 1 }}>{children}</Box>}
    </div>
  );
};

export default TabPanel;
