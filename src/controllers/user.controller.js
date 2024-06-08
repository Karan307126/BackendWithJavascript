import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
  /*
   1. Get User details from frontend
   2. Validation for empty field
   3. Check if User already exist by Username or Email
   4. Check for images -> Avatar check (Required)
   5. Upload images into cloudinary -> Avatar 
   6. Create User object and create entry in db
   7. Remove password and refresh token from response
   8. Check for user creation
   9. return res to frontend
  */

  const { fullName, email, userName, password } = req.body;

  console.log("Body: ", req.body);

  if (
    [fullName, userName, password, email].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const isUserExist = User.findOne({ $or: [{ userName }, { email }] });

  console.log("Is User Exists: ", isUserExist);

  if (isUserExist)
    throw new ApiError(409, "User with email or username is already existed");

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  console.log("Files (Avatar and CoverImage): ", req.files);

  if (!avatarLocalPath) throw new ApiError(400, "Avatar Image is required");

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new ApiError(400, "Avatar Image is required");

  const user = await User.create({
    fullName,
    userName: userName.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser)
    throw ApiError(500, "Something went wrong while creating user");

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created Successfully"));
});

export { registerUser };
