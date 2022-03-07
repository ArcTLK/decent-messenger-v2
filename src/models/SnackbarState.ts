import { AlertColor } from '@mui/material/Alert';

export default interface SnackbarState {
    isOpen: boolean;
    type: AlertColor;
    message: string;
    autoHideDuration: number;
}