import multer from 'multer'
import * as database from './database.js'
import express from 'express'
import crypto from 'crypto'
import * as s3 from './s3.js'
import sharp from 'sharp'


const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
const app = express()

app.use(express.static('dist'))


app.get("/api/images", async (req, res) => {
    const images = await database.getImages()
    console.log(images)

    // Add the signed url to each image
    for (const image of images) {
        image.url = await s3.getSignedUrl(image.file_path)
    }

    res.send(images)
})

app.post("/api/images", upload.single('image'), async (req, res) => {

    // Get the data from the post request
    const description = req.body.description
    const fileBuffer = await sharp(req.file.buffer).resize({ height: 640, width: 480, fit: "contain" }).toBuffer()
    const mimetype = req.file.mimetype
    const fileName = generateFileName()

    // Store the image in s3
    const s3Result = await s3.uploadImage(fileBuffer, fileName, mimetype)
    console.log(s3Result)

    // Store the image in the database
    const databaseResult = await database.addImage(fileName, description)
    console.log(databaseResult)

    databaseResult.url = await s3.getSignedUrl(databaseResult.file_path)

    res.status(201).send(databaseResult)
})


app.delete("/api/images/:id", async (req, res) => {
    const id = +req.params.id
    const post = await database.getImage(id)

    await s3.deleteImage(post.file_path)
    await database.deleteImage(id)

    res.send(post)
})

const port = process.env.PORT || 8080

app.listen(port, () => console.log("Server is running on port " + port))