import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useDispatch, useSelector, useStore } from 'react-redux'

import { SocketContext } from './socketContext'
import { serverURL } from '../config/serverUrl'
import { setOnlineUsers } from '../redux/socketSlise'
import { prependNotification } from '../redux/notificationSlice'
import { addMessage, markMessagesReadBy } from '../redux/messageSlice'

const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b)

function SocketProvider({ children }) {
    const dispatch = useDispatch()
    // useStore (not useSelector) so the handlers below read the freshest
    // selectedUser without re-subscribing the socket on every chat switch.
    const store = useStore()
    const userId = useSelector((state) => state.user.userData?._id)
    const [socket, setSocket] = useState(null)

    useEffect(() => {
        if (!userId) {
            dispatch(setOnlineUsers([]))
            setSocket(null)
            return undefined
        }

        // websocket only: the backend runs a Node cluster without sticky
        // sessions, so a polling handshake that lands on worker A and then
        // polls worker B fails with "Session ID unknown" and reconnect-loops.
        const socketIo = io(serverURL, { withCredentials: true, transports: ['websocket'] })
        setSocket(socketIo)

        socketIo.on('getOnlineUsers', (users) => {
            dispatch(setOnlineUsers(users))
        })

        socketIo.on('notification', (notification) => {
            dispatch(prependNotification(notification))
        })

        socketIo.on('newMessage', (message) => {
            const state = store.getState()
            const selectedUserId = state.message.selectedUser?._id
            if (!selectedUserId) return

            const peerId = sameId(message?.sender, userId) ? message?.receiver : message?.sender
            if (!sameId(peerId, selectedUserId)) return

            dispatch(addMessage(message))
        })

        socketIo.on('messagesRead', (payload) => {
            dispatch(markMessagesReadBy(payload?.by))
        })

        return () => {
            socketIo.off('getOnlineUsers')
            socketIo.off('notification')
            socketIo.off('newMessage')
            socketIo.off('messagesRead')
            socketIo.close()
            setSocket((current) => (current === socketIo ? null : current))
        }
    }, [dispatch, store, userId])

    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

export default SocketProvider
