import React from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import { ModalBackdrop, ModalContainer, ModalWrapper, CloseButton, CustomLangFlag } from "./styled";

interface Props {
  open: boolean;
  languages: { code: string; label: string; flag: any }[];
  onSelect: (code: string) => void;
  onClose: () => void;
  currentLanguage?: string;
}



const LanguageSwitcherModal: React.FC<Props> = ({
  open,
  languages,
  onSelect,
  onClose,
  currentLanguage,
}) => {
  const theme = useTheme();
    return (
    <>
      <ModalBackdrop open={open} onClick={onClose} />
      <ModalContainer>
        {open && (
          <CloseButton onClick={onClose} size="small">
            <CloseIcon sx={{color: (theme: any) => theme.palette.text.secondary}} />
          </CloseButton>
        )}
        <ModalWrapper open={open}>
          <List sx={{ width: "100%", p: 0 }}>
            {languages.map((lng) => {
              const active = lng.code === currentLanguage;

              return (
                <ListItemButton
                  key={lng.code}
                  onClick={() => {
                    onSelect(lng.code);
                    onClose();
                  }}
                  sx={{
                    borderRadius: "50px",
                    mb: "1px",
                    height: "32px",
                    minHeight: "32px",
                    gap: 2,
                    background: active
                      ? theme.palette.primary.light
                      : "transparent",
                    "&:hover": {
                      background: theme.palette.primary.light,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: "fit-content" }}>
                    <CustomLangFlag src={lng.flag.src} alt={lng.label} />
                  </ListItemIcon>

                  <ListItemText
                    sx={{
                      fontSize: "15px",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      "& .MuiListItemText-primary": {
                        fontSize: "15px",
                      },
                    }}
                    primary={`${lng.code.toUpperCase()} – ${lng.label}`}
                  />

                  {active && <CheckIcon sx={{color: (theme: any) => theme.palette.text.secondary}} />}
                </ListItemButton>
              );
            })}
          </List>
        </ModalWrapper>
      </ModalContainer>
    </>
  );
};

export default LanguageSwitcherModal;
