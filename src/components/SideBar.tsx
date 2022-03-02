import { useState, useContext } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import { Box, TextField, Avatar, IconButton, Divider, List, ListItem, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import Contact from '../models/Contact';
import { Context } from '../utils/Store';

// <DummyData>
const contactList: Contact[] = [];
for (let i = 0; i < 20; i++) {
    contactList.push({
        name: `John Doe ${i + 1}`,
        username: `john_doe${i + 1}`,
        server: "",
        peerId: ""
    } as Contact);
}
// </DummyData>

const SideBar = () => {
    const {state, dispatch} = useContext(Context);

    const [searchUser, setSearchUser] = useState('');

    const onSearchButtonClick = () => {
        // console.log('Search User:', searchUser);

        // Handle User Search Here
    };

    const onSettingsButtonClick = () => {
        // Handle Settings Button Click Here
    };

    const setCurrentChatUser = (contact: Contact) => {
        dispatch({
            type: 'UpdateCurrentChatUser',
            payload: contact
        });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: 360, flexGrow: 1 }}>

            {/* SideBar Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar />
                    <Typography variant="h6" component="div">John Doe 0</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center' }}>
                    <IconButton onClick={onSettingsButtonClick}>
                        <SettingsIcon />
                    </IconButton>
                </Box>
            </Box>

            <Divider />

            {/* SearchBar */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 2 }}>
                <TextField fullWidth onChange={e => setSearchUser(e.target.value)} size='small' label="Search User" type="search" />
                <IconButton onClick={onSearchButtonClick}>
                    <SearchIcon />
                </IconButton>
            </Box>

            <Divider />

            {/* RecentChatUsers */}
            <List sx={{ overflow: "auto" }}>
                {contactList.map(contact => (
                    <ListItem button key={contact.username} onClick={() => setCurrentChatUser(contact)}>
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