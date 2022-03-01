import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import { Box, TextField, Avatar, IconButton, Divider, List, ListItem, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import Contact from '../models/Contact';

const SideBar = () => {

    /**
     * Dummy Data
     */
    const contactList = [];
    for (let i = 0; i < 20; i++) {
        contactList.push({
            name: `John Doe ${i + 1}`,
            username: `john_doe${i + 1}`,
            server: "",
            peerId: ""
        } as Contact);
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: 360, flexGrow: 1 }}>

            {/* SideBar Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar />
                    <Typography variant="h6" component="div">John Doe 0</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center' }}>
                    <IconButton>
                        <SettingsIcon />
                    </IconButton>
                </Box>
            </Box>

            <Divider />

            {/* SearchBar */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 2 }}>
                <TextField fullWidth size='small' label="Search User" type="search" />
                <IconButton>
                    <SearchIcon />
                </IconButton>
            </Box>

            <Divider />

            {/* RecentChatUsers */}
            <List sx={{ overflow: "auto" }}>
                {contactList.map(contact => (
                    <ListItem button key={contact.username}>
                        <ListItemAvatar>
                            <Avatar alt={contact.name} />
                        </ListItemAvatar>
                        <ListItemText
                            primary={contact.name}
                            secondary={contact.username}>
                        </ListItemText>
                    </ListItem>
                ))}
            </List>

        </Box>
    );
};

export default SideBar;