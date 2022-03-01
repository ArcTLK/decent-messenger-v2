import { Box, Avatar, Divider } from '@mui/material';

const ChatPanel = () => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 3 }}>
            {/* ChatPanel Header */}
            <Box sx={{ p: 2 }}>
                <Avatar />
            </Box>

            <Divider />
            
        </Box>
    );
};

export default ChatPanel;