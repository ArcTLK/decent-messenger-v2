import { useState, useContext } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import BugReportIcon from '@mui/icons-material/BugReport';
import { Button, Checkbox, Dialog, DialogActions, DialogTitle, DialogContent, DialogContentText, Box, TextField, Avatar, IconButton, Divider, List, ListItem, ListSubheader, ListItemButton, ListItemIcon, ListItemAvatar, ListItemText, Typography, Stack } from '@mui/material';
import Contact from '../models/Contact';
import { Context, SimpleObjectStore } from '../utils/Store';
import { DeleteForever } from '@mui/icons-material';
import Database from '../utils/Database';
import { createGroup, doRsaPublicKeyExchange, getPeerDataFromUsername } from '../utils/Peer';
import { useLiveQuery } from 'dexie-react-hooks';
import ErrorType from '../enums/ErrorType';
import { addLog } from '../models/Log';
import { v4 } from 'uuid';
import LogType from '../enums/LogType';
import ChatType from '../enums/ChatType';
import Group from '../models/Group';

const SideBar = () => {
    const {state, dispatch} = useContext(Context);

    const [searchUser, setSearchUser] = useState('');

    const [isCreateGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
    
    const [contactsInNewGroup, setContactsOfNewGroup] = useState([] as Contact[]);

    const [newGroupName, setNewGroupName] = useState('');
    
    const contacts = useLiveQuery(async () => {
        return await Database
            .contacts
            .toArray();
    }, []);

    const groups = useLiveQuery(async () => {
        return await Database
            .groups
            .toArray();
    });

    const onAddContactButtonClick = () => {
        if (searchUser === '') {
            dispatch({
				type: 'UpdateSnackbar',
				payload: {
					isOpen: true,
					type: 'error',
					message: 'Please enter a username'
				}
			});

            return;
        }

        // Handle Add Contact Here
        const targetName = searchUser;
        const uuid = v4();
        addLog('Fetching Peer Data for ' + targetName, uuid, 'Adding Contact (Sender)');
        getPeerDataFromUsername(targetName).then(peerData => {
            addLog('Executing RSA public key exchange for user ' + targetName, uuid, 'Adding Contact (Sender)');
            doRsaPublicKeyExchange(state.user.username, targetName, uuid).then(key => {
                // create contact object
                const contact: Contact = {
                    name: peerData.name,
                    username: targetName,
                    publicKey: key
                };

                // check if contact exists before adding
                Database.contacts.where({ username: targetName }).first().then(x => {
                    if (!x) {
                        // does not exist
                        Database.contacts.add(contact).then(() => {
                            addLog('Created and saved contact for ' + targetName, uuid, 'Adding Contact (Sender)', LogType.Info, 1);
                        });
                    }
                });

                setSearchUser('');
            }).catch(error => {
                console.error(error);
                dispatch({
                    type: 'UpdateSnackbar',
                    payload: {
                        isOpen: true,
                        type: 'error',
                        message: 'User is currently offline, so cannot perform RSA Key exchange!'
                    }
                });
            });
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

    const handleToggleContactOnCreatingGroup = (contact: Contact) => {
        if(contactsInNewGroup.includes(contact)) {
            setContactsOfNewGroup(contactsInNewGroup.filter(x => x.username !== contact.username));
        }
        else {
            setContactsOfNewGroup([...contactsInNewGroup, contact]);
        }
    };

    const onCreateGroupDialogClose = () => {
        setNewGroupName('');
        setContactsOfNewGroup([]);
        setCreateGroupDialogOpen(false);
    };

    const onConfirmCreateGroup = () => {
        // Handle when user clicks on create button in create group dialog
        if (newGroupName == '') {
            return dispatch({
                type: 'UpdateSnackbar',
                payload: {
                    isOpen: true,
                    type: 'error',
                    message: 'Please enter a group name!'
                }
            });
        }

        if (contactsInNewGroup.length === 0) {
            return dispatch({
                type: 'UpdateSnackbar',
                payload: {
                    isOpen: true,
                    type: 'error',
                    message: 'Please select at least one group participant!'
                }
            });
        }

        console.log('Creating new group:', newGroupName);
        console.log('Participants:', contactsInNewGroup);

        createGroup(state.user, newGroupName, contactsInNewGroup).then(() => {
            onCreateGroupDialogClose();
        });
    };

    const setCurrentChat = (type: ChatType, data: Contact | Group) => {
        dispatch({
            type: 'UpdateCurrentChat',
            payload: {
                type: type,
                data: data
            }
        });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: 360, flexGrow: 1 }}>

        {/* Dialog for creating new group */}
        <Dialog open={isCreateGroupDialogOpen} onClose={onCreateGroupDialogClose} fullWidth={true} maxWidth='xs'>
            <DialogTitle sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <GroupAddIcon />
                <Typography variant="h6" component={'span'}>Create Group</Typography>
            </DialogTitle>
            <DialogContent dividers={true} sx={{ p: 2 }}>
                <TextField sx={{ mb: 2 }} label="Group Name" onChange={e => setNewGroupName(e.target.value)} size='small' fullWidth />
                
                <List sx={{ overflow: "auto" }} subheader={
                    <ListSubheader>Add Participants</ListSubheader>
                    }
                >
                    {contacts && contacts.map((contact: Contact) => (
                        <ListItem key={contact.username} sx={{ p: 0 }}>
                            <ListItemButton onClick={() => handleToggleContactOnCreatingGroup(contact)}>
                                <ListItemIcon>
                                    <Checkbox edge="start" checked={contactsInNewGroup.includes(contact)} tabIndex={-1} disableRipple />
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
                    <Stack>
                        <Typography variant="h6" sx={{ color: 'white' }}>{state.user.name}</Typography>
                        <Typography variant="body2" sx={{ color: '#ccc' }}>{state.user.username}</Typography>
                    </Stack>                    
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center' }}>
                    <IconButton onClick={onSettingsButtonClick} sx={{ color: 'white' }}>
                        <SettingsIcon />
                    </IconButton>
                    
                    {/* For Debugging */}
                    <IconButton onClick={() => {
                        console.log(state);
                        Database.groups.toArray().then(data => console.log(data));
                    }} sx={{ color: 'white' }}>
                        <BugReportIcon />
                    </IconButton>

                    {/* For Debugging */}
                    <IconButton onDoubleClick={() => {
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
                <TextField fullWidth onChange={e => setSearchUser(e.target.value)} value={searchUser} size='small' label="Search User" type="search" />
                <IconButton onClick={onAddContactButtonClick}>
                    <AddIcon />
                </IconButton>
            </Box>

            <Divider />

            {/* RecentChatUsers */}
            <List sx={{ overflow: "auto" }}>
                {groups && groups.filter((group: Group) => group.name.toLowerCase().includes(searchUser.toLowerCase())).map((group: Group) => (
                    <ListItemButton key={group.createdAt} selected={Object.keys(state.currentOpenedChat).length !== 0 && state.currentOpenedChat.data.name === group.name} onClick={() => {
                        setCurrentChat(ChatType.Group, group);
                        SimpleObjectStore.groupManagers.find(x => x.group.name === group.name && x.group.createdAt === group.createdAt)?.connect();
                    }}>
                        <ListItemAvatar>
                            <Avatar src={`https://avatars.dicebear.com/api/human/${group.name}.svg`} alt={group.name} />
                        </ListItemAvatar>
                        <ListItemText
                            primary={group.name}
                            secondary={`last message from ${group.name}`}>
                        </ListItemText>
                    </ListItemButton>
                ))}

                {contacts && contacts.filter((contact: Contact) => contact.name.toLowerCase().includes(searchUser.toLowerCase())).map((contact: Contact) => (
                    <ListItemButton key={contact.username} selected={Object.keys(state.currentOpenedChat).length !== 0 && (state.currentOpenedChat.data as Contact).username === contact.username} onClick={() => setCurrentChat(ChatType.Private, contact)}>
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