import { useState, useContext } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import BugReportIcon from '@mui/icons-material/BugReport';
import { Box, TextField, Avatar, IconButton, Divider, List, ListItemButton, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import Contact from '../models/Contact';
import { Context } from '../utils/Store';
import { DeleteForever } from '@mui/icons-material';
import Database from '../utils/Database';
import { doRsaPublicKeyExchange, getPeerDataFromUsername, peerBank } from '../utils/Peer';
import { useLiveQuery } from 'dexie-react-hooks';
import ErrorType from '../enums/ErrorType';

const SideBar = () => {
    const {state, dispatch} = useContext(Context);

    const [searchUser, setSearchUser] = useState('');

    const contacts = useLiveQuery(async () => {
        return await Database
            .contacts
            .toArray();
    }, []);

    const onAddContactButtonClick = () => {
        // Handle Add Contact Here
        getPeerDataFromUsername(searchUser).then(peerData => {
            console.log('Executing RSA public key exchange for user ' + searchUser);
            doRsaPublicKeyExchange(state.user.username, searchUser).then(key => {
                // create contact object
                const contact: Contact = {
                    name: peerData.name,
                    username: searchUser,
                    publicKey: key
                };

                Database.contacts.add(contact);              
                setSearchUser('');
            }).catch(error => {
                if (error === ErrorType.KeyExchangeTimeout) {
                    alert('User is currently offline, so cannot perform RSA Key exchange!');
                }
                else throw new Error(error);
            }).finally(() => {
                peerBank.releaseUsage(searchUser);
            })
        }).catch(error => {
            alert(error);
        });
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'primary.main' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={`https://avatars.dicebear.com/api/human/${state.user.username}.svg`} />
                    <Typography variant="h6" sx={{ color: 'white' }}>{state.user.name}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center' }}>
                    <IconButton onClick={onSettingsButtonClick} sx={{ color: 'white' }}>
                        <SettingsIcon />
                    </IconButton>
                    
                    {/* For Debugging */}
                    <IconButton onClick={() => console.log(state)} sx={{ color: 'white' }}>
                        <BugReportIcon />
                    </IconButton>

                    {/* For Debugging */}
                    <IconButton onClick={() => {
                        console.log('Database erased');
                        Database.erase();
                        dispatch({
                            type: 'RevertState'
                        });
                    }} sx={{ color: 'white' }}>
                        <DeleteForever />
                    </IconButton>
                </Box>
            </Box>

            <Divider />

            {/* SearchBar */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 2 }}>
                <TextField fullWidth onChange={e => setSearchUser(e.target.value)} size='small' label="Search User" type="search" />
                <IconButton onClick={onAddContactButtonClick}>
                    <AddIcon />
                </IconButton>
            </Box>

            <Divider />

            {/* RecentChatUsers */}
            <List sx={{ overflow: "auto" }}>
                {contacts && contacts.filter(contact => contact.name.toLowerCase().includes(searchUser.toLowerCase())).map(contact => (
                    <ListItemButton key={contact.username} selected={Object.keys(state.currentChatUser).length !== 0 && state.currentChatUser.username === contact.username} onClick={() => setCurrentChatUser(contact)}>
                        <ListItemAvatar>
                            <Avatar src={`https://avatars.dicebear.com/api/human/${contact.username}.svg`} alt={contact.name} />
                        </ListItemAvatar>
                        <ListItemText
                            primary={contact.name}
                            secondary={`last message from ${contact.username}`}>
                        </ListItemText>
                    </ListItemButton>
                ))}
            </List>
        </Box>
    );
};

export default SideBar;