import express from 'express'
import isAuth from '../middlewars/isAuth.js'
import {upload} from '../middlewars/multer.js'
import { getAllStories, getStoryByUserName, uploadStory, viewStory } from '../controllers/story.controllers.js'


const storyRouter=express.Router()

storyRouter.post('/upload', isAuth, upload.single('media'),uploadStory)
storyRouter.get('/getByUserName/:userName', isAuth, getStoryByUserName)
storyRouter.get('/getAll', isAuth, getAllStories)
storyRouter.get('/view/:storyId', isAuth, viewStory)


export default storyRouter