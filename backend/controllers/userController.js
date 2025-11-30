import validator from "validator";
import bcrypt from "bcrypt";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import razorpay from "razorpay";

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !password || !email) {
      return res.json({ success: false, message: "Missing Details" });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Enter a valid email" });
    }

    if (password.length < 6) {
      return res.json({ success: false, message: "Enter a strong password" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userData = {
      name,
      email,
      password: hashedPassword,
    };

    const newUser = new userModel(userData);
    const user = await newUser.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({ success: true, token });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// ---------------API for user login---------------

const loginUser = async (req, res) => {
  try {
    console.log("Login Body:", req.body); // <--- check values

    const { email, password } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "User does not exist" });
    }

    console.log("DB hashed password:", user.password); // <--- debugging

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password Match:", isMatch); // <--- result

    if (isMatch) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

//---------------API to get user profile data---------------

const getProfile = async (req, res) => {
  try {
    const userId = req.userId; // get from middleware

    const userData = await userModel.findById(userId).select("-password");

    return res.json({ success: true, userData });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// API to update user profile

const updateProfile = async (req, res) => {
  try {
    const { name, phone, address, dob, gender } = req.body;
    const imageFile = req.file;

    if (!name || !phone || !dob || !gender) {
      return res.json({ success: false, message: "Data Missing" });
    }

    // Update profile data
    await userModel.findByIdAndUpdate(req.userId, {
      name,
      phone,
      address: JSON.parse(address),
      dob,
      gender,
    });

    // If image present
    if (imageFile) {
      const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
        resource_type: "image",
      });
      const imageUrl = imageUpload.secure_url;

      await userModel.findByIdAndUpdate(req.userId, { image: imageUrl });
    }

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// ------------------API to book appointment-------------

const bookAppointment = async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { docId, slotDate, slotTime } = req.body;

    if (!userId)
      return res.json({ success: false, message: "User not authenticated" });
    if (!docId || !slotDate || !slotTime)
      return res.json({ success: false, message: "Missing booking data" });

    const docData = await doctorModel
      .findById(docId)
      .select("-password")
      .lean();
    if (!docData)
      return res.json({ success: false, message: "Doctor not found" });

    // update slots_booked safely
    const slots_booked = docData.slots_booked || {};
    if (slots_booked[slotDate]) {
      if (slots_booked[slotDate].includes(slotTime)) {
        return res.json({ success: false, message: "Slot not available" });
      }
      slots_booked[slotDate].push(slotTime);
    } else {
      slots_booked[slotDate] = [slotTime];
    }

    const userData = await userModel
      .findById(userId)
      .select("-password")
      .lean();
    if (!userData)
      return res.json({ success: false, message: "User not found" });

    const appointmentPayload = {
      userId,
      docId,
      slotDate,
      slotTime,
      docData, // snapshot of doctor
      userData,
      amount: Number(docData.fees || docData.fee || 0),
    };

    // Option A (preferred): create with the model helper
    const createdAppointment = await appointmentModel.create(
      appointmentPayload
    );

    // persist updated slots to doctor
    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    return res.json({
      success: true,
      message: "Appointment booked successfully",
      appointment: createdAppointment,
    });
  } catch (error) {
    console.error("bookAppointment error:", error);
    return res.json({ success: false, message: error.message });
  }
};

// ------------------API to list user appointments-------------

const listAppointment = async (req, res) => {
  try {
    // prefer req.userId set by auth middleware, fallback to req.body.userId
    const userId = req.userId || req.body.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    // find appointments for the user (assuming appointmentModel stores userId)
    const appointments = await appointmentModel
      .find({ userId })
      .sort({ createdAt: -1 });

    return res.json({ success: true, appointments });
  } catch (error) {
    console.error("listAppointment error:", error);
    return res.json({ success: false, message: error.message });
  }
};

// -----------------API to cencel appointment----------------

const cancelAppointment = async (req, res) => {
  try {
    const { userId, appointmentId } = req.body;

    const appointmentData = await appointmentModel.findById(appointmentId);

    if (!appointmentData) {
      return res.json({ success: false, message: "Appointment not found" });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, {
      cancelled: true,
    });

    // releasing doctor slot

    const { docId, slotDate, slotTime } = appointmentData;

    const doctorData = await doctorModel.findById(docId);

    let slots_booked = doctorData.slots_booked;

    if (slots_booked[slotDate]) {
      slots_booked[slotDate] = slots_booked[slotDate].filter(
        (slot) => slot !== slotTime
      );
    }

    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    res.json({ success: true, message: "Appointment cancelled successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ---------------API to make payment for appointment---------------

const paymentRazorpay = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const appointmentData = await appointmentModel.findById(appointmentId);

    if (!appointmentData || appointmentData.cancelled) {
      return res.json({ success: false, message: "Appointment Cancelled or not found" });
    }

    const options = {
      amount: appointmentData.amount * 100, // amount in the smallest currency unit
      currency: process.env.CURRRENCY || "INR",
      receipt: `receipt_order_${appointmentId}`,
    };

    const order = await razorpayInstance.orders.create(options);
    res.json({ success: true, order });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// ---------------API to verify payment of razorpay---------------

const verifyRazorpay = async (req, res) => {
  try {
    
    const {razorpay_order_id} = req.body;
    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);

    if(orderInfo.status === 'paid'){
      await appointmentModel.findByIdAndUpdate(orderInfo.receipt, {payment:true});
      res.json({ success: true, message: "Payment  successfully" });
    }

    else{
      res.json({ success: false, message: "Payment failed" });
    }

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message });
  }
}

export {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  bookAppointment,
  listAppointment,
  cancelAppointment,
  paymentRazorpay,
  verifyRazorpay
};
