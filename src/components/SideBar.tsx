import { useState, useContext } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import BugReportIcon from '@mui/icons-material/BugReport';
import { Button, Checkbox, Dialog, DialogActions, DialogTitle, DialogContent, DialogContentText, Box, TextField, Avatar, IconButton, Divider, List, ListItem, ListSubheader, ListItemButton, ListItemIcon, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import Contact from '../models/Contact';
import { Context } from '../utils/Store';
import { DeleteForever } from '@mui/icons-material';
import Database from '../utils/Database';
import { doRsaPublicKeyExchange, getPeerDataFromUsername, peerBank } from '../utils/Peer';
import { useLiveQuery } from 'dexie-react-hooks';
import ErrorType from '../enums/ErrorType';
import { addLog } from '../models/Log';
import { v4 } from 'uuid';
import LogType from '../enums/LogType';

const SideBar = () => {
    const {state, dispatch} = useContext(Context);

    const [searchUser, setSearchUser] = useState('');

    const [isCreateGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
    
    const [contactsInNewGroup, setContactsOfNewGroup] = useState([] as string[]);

    const [newGroupName, setNewGroupName] = useState('');
    
    const contacts = useLiveQuery(async () => {
        return await Database
            .contacts
            .toArray();
    }, []);

    const onAddContactButtonClick = () => {
        // Handle Add Contact Here
        const uuid = v4();
        addLog('Fetching Peer Data for ' + searchUser, uuid, 'Adding Contact (Sender)');
        getPeerDataFromUsername(searchUser).then(peerData => {
            addLog('Executing RSA public key exchange for user ' + searchUser, uuid, 'Adding Contact (Sender)');
            doRsaPublicKeyExchange(state.user.username, searchUser, uuid).then(key => {
                // create contact object
                const contact: Contact = {
                    name: peerData.name,
                    username: searchUser,
                    publicKey: key
                };

                Database.contacts.add(contact);              

                addLog('Created and saved contact for ' + searchUser, uuid, 'Adding Contact (Sender)', LogType.Info, 1);
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

    const onCreateGroupButtonClick = () => {
        setCreateGroupDialogOpen(true);
    };

    const handleToggleContactOnCreatingGroup = (username: string) => {
        if(contactsInNewGroup.indexOf(username) !== -1) {
            setContactsOfNewGroup(contactsInNewGroup.filter((us: string) => us !== username));
        }
        else {
            setContactsOfNewGroup([...contactsInNewGroup, username]);
        }
    };

    const onCreateGroupDialogClose = () => {
        setNewGroupName('');
        setContactsOfNewGroup([]);
        setCreateGroupDialogOpen(false);
    };

    const onConfirmCreateGroup = () => {
        // Handle when user clicks on create button in create group dialog
        console.log('Creating new group:', newGroupName);
        console.log('Participants:', contactsInNewGroup);

        // todo - code to create new group
        

        //onCreateGroupDialogClose();
    };

    const setCurrentChatUser = (contact: Contact) => {
        dispatch({
            type: 'UpdateCurrentChatUser',
            payload: contact
        });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: 360, flexGrow: 1 }}>

        {/* Dialog for creating new group */}
        <Dialog open={isCreateGroupDialogOpen} onClose={onCreateGroupDialogClose} fullWidth={true} maxWidth='xs'>
            <DialogTitle sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <GroupAddIcon />
                <Typography variant="h6">Create Group</Typography>
            </DialogTitle>
            <DialogContent dividers={true} sx={{ p: 2 }}>
                <DialogContentText sx={{ mb: 2 }}>
                    <TextField label="Group Name" onChange={e => setNewGroupName(e.target.value)} size='small' fullWidth />
                </DialogContentText>
                
                <List sx={{ overflow: "auto" }} subheader={
                    <ListSubheader>Add Participants</ListSubheader>
                    }
                >
                    {contacts && contacts.map((contact: Contact) => (
                        <ListItem key={contact.username} sx={{ p: 0 }}>
                            <ListItemButton onClick={() => handleToggleContactOnCreatingGroup(contact.username)}>
                                <ListItemIcon>
                                    <Checkbox edge="start" checked={contactsInNewGroup.indexOf(contact.username) !== -1} tabIndex={-1} disableRipple />
                                </ListItemIcon>
                                <ListItemAvatar>
                                    <Avatar src={`https://avatars.dicebear.com/api/human/${contact.username}.svg`} alt={contact.name} />
                                </ListItemAvatar>
                                <ListItemText primary={contact.name} secondary={contact.username}>
                                </ListItemText>
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </DialogContent>
            <DialogActions sx={{ my: 1 }}>
                <Button variant="outlined" onClick={onCreateGroupDialogClose}>Cancel</Button>
                <Button variant="contained" onClick={onConfirmCreateGroup}>Create</Button>
            </DialogActions>
        </Dialog>

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

                    <IconButton onClick={onCreateGroupButtonClick} sx={{ color: 'white' }}>
                        <GroupAddIcon />
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
                {contacts && contacts.filter((contact: Contact) => contact.name.toLowerCase().includes(searchUser.toLowerCase())).map((contact: Contact) => (
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