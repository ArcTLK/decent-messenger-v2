import { forwardRef, useContext } from 'react';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import { Context } from '../utils/Store';

const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});


const SnackbarElement = () => {
    const {state, dispatch} = useContext(Context);

    const handleClosingSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
          return;
        }

        dispatch({
            type: 'UpdateSnackbar',
            payload: {
                isOpen: false
            }
        });
    };

    return (
        <Snackbar open={state.snackbar.isOpen} autoHideDuration={state.snackbar.autoHideDuration} onClose={handleClosingSnackbar}>
            <Alert onClose={handleClosingSnackbar} severity={state.snackbar.type} sx={{ width: '100%' }}>
                {state.snackbar.message}
            </Alert>
        </Snackbar>
    );
}

export default SnackbarElement;