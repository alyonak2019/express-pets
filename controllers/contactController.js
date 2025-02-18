const sanitizeHtml = require("sanitize-html")
const { ObjectId } = require("mongodb")
const petsCollection = require("../db").db().collection("pets")
const contactsCollection = require("../db").db().collection("contacts")
const nodemailer = require("nodemailer")
const validator = require("validator")

const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {}
}

exports.submitContact = async function (req, res, next) {
  if (req.body.secret.toUpperCase() !== "PUPPY") {
    console.log("spam detected")
    return res.json({ message: "access denied" })
  }

  if (typeof req.body.name != "string") {
    req.body.name = ""
  }

  if (typeof req.body.email != "string") {
    req.body.email = ""
  }

  if (typeof req.body.comment != "string") {
    req.body.comment = ""
  }

  if (!validator.isEmail(req.body.email)) {
    console.log("invalid email detected")
    return res.json({ message: "full stop" })
  }

  if (!ObjectId.isValid(req.body.petId)) {
    console.log("invaid id detected")
    return res.json({ message: "access denied" })
  }

  req.body.petId = new ObjectId(req.body.petId);
  const doesPetExist = await petsCollection.findOne({ _id: req.body.petId })

  if (!doesPetExist) {
    console.log("pet does not exist!")
    return res.json({ message: "access denied" })
  }

  const ourObject = {
    name: sanitizeHtml(req.body.name, sanitizeOptions),
    email: sanitizeHtml(req.body.email, sanitizeOptions),
    comment: sanitizeHtml(req.body.comment, sanitizeOptions),
    petId: req.body.petId
  }

  console.log(ourObject)

  // Looking to send emails in production? Check out our Email API/SMTP product!
  var transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAPUSERNAME,
      pass: process.env.MAILTRAPPASSWORD,
    }
  })

  try {

    const promise1 = transport.sendMail({
      to: ourObject.email,
      from: "petadoption@localhost",
      subject: `Thank you for your intrest in ${doesPetExist.name}`,
      html: `<h3 style="color: purple; font-size: 1.85rem; font-weight: normal;">Thank you!</h3>
      <p>We appreciate your intrest in ${doesPetExist.name} and one of our staff members will reach out to you shortly! Below is a copy of the message you sent us for your personal records:</p>
      <p><em>${ourObject.comment}</em></p>`
    })

    const promise2 = transport.sendMail({
      to: "petadoption@localhost",
      from: ourObject.email,
      subject: `Someone is interested in ${doesPetExist.name}`,
      html: `<h3 style="color: purple; font-size: 1.85rem; font-weight: normal;">New Contact!</h3>
      <p>Name: ${ourObject.name}<br>
      Pet interested in:  ${doesPetExist.name}<br>
      Email: ${ourObject.email}<br>
      Comment: ${ourObject.comment}<br>
      </p>`
    })

    const promise3 = contactsCollection.insertOne(ourObject)

    await Promise.all([promise1, promise2, promise3])

  } catch (err) {
    next(err)
  }



  res.send("thanks for sending data to us")
}

exports.viewPetContacts = async function (req, res) {
  if (!ObjectId.isValid(req.params.id)) {
    console.log("bad id")
    return res.redirect("/")
  }

  // req.body.petId = new ObjectId(req.body.petId);
  const pet = await petsCollection.findOne({ _id: new ObjectId(req.params.id) })

  if (!pet) {
    console.log("pet does not exist!")
    return res.redirect("/")
  }

  const contacts = await contactsCollection.find({ petId: new ObjectId(req.params.id) }).toArray()
  res.render("pet-contacts", { contacts, pet })
}