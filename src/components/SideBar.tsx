import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import { Box, TextField, Avatar, IconButton, Divider } from '@mui/material';

const SideBar = () => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: 360, flexGrow: 1 }}>
            
            {/* SideBar Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                <Avatar />
                <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center' }}>
                    <IconButton>
                        <SettingsIcon />
                    </IconButton>
                </Box>
            </Box>

            <Divider />
            
            {/* SearchBar */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1 }}>
                <TextField fullWidth size='small' label="Search User" type="search" />
                <IconButton>
                    <SearchIcon />
                </IconButton>
            </Box>

            <Divider />


            {/* RecentChatUsers */}

        </Box>
    );
};

export default SideBar;