import express from 'express'
import isAuth from '../middlewars/isAuth.js'
import {
    deleteProfile,
    editProfile,
    follow,
    getFollowers,
    getFollowing,
    getFollowStatus,
    getCurrentUser,
    getProfile,
    getUserById,
    searchUsers,
    suggestedUsers,
    changePassword,
    logoutAll,
    setPlan,
} from '../controllers/user.controllers.js'
import {upload} from '../middlewars/multer.js'

const userRouter=express.Router()

userRouter.get('/current', isAuth, getCurrentUser)
userRouter.get('/suggested', isAuth, suggestedUsers)
userRouter.get('/search', isAuth, searchUsers)
userRouter.get('/getProfile/:userName', isAuth, getProfile)
userRouter.get('/:userId', isAuth, getUserById)
userRouter.get('/:userId/followers', isAuth, getFollowers)
userRouter.get('/:userId/following', isAuth, getFollowing)
userRouter.get('/:targetUserId/follow-status', isAuth, getFollowStatus)
userRouter.post('/follow/:targetUserId', isAuth, follow)
userRouter.post('/editProfile', isAuth, upload.single("profileImage"), editProfile)
userRouter.patch('/changePassword', isAuth, changePassword)
userRouter.post('/logoutAll', isAuth, logoutAll)
userRouter.patch('/plan', isAuth, setPlan)
userRouter.delete('/profile', isAuth, deleteProfile)

export default userRouter