import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await generateAccessToken();
    const refreshToken = await generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while creating access token or refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  /*
   1. Get User details from frontend
   2. Validation for empty field
   3. Check if User already exist by Username or Email
   4. Check for images -> Avatar check (Required)
   5. Upload images into cloudinary -> Avatar and CoverImage
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

  const isUserExist = await User.findOne({ $or: [{ userName }, { email }] });

  console.log("Is User Exists: ", isUserExist);

  if (isUserExist)
    throw new ApiError(409, "User with email or username is already existed");

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

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

const loginUser = asyncHandler(async (req, res) => {
  /* 
   1. Get login credentials from frontend
   2. Validate for empty field (userName or email and password)
   3. Check for if user exist or not (Find user based on userName or email)
   4. Check password match or not
   5. Generate the access token and refresh token
   6. Send access and refresh token in cookie
   7. Send response to the frontend with success
  */

  const { userName, email, password } = req.body;

  if ((!userName || !email) && !password)
    throw new ApiError(400, "Username or email and password is required");

  const user = await User.findOne({
    $or: [{ email }, { userName }],
  });

  if (!user) throw new ApiError(404, "User dose not exists");

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) throw new ApiError(401, "Invalid login credentials");

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  const loggedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  /*
   1. Clear all cookie and clear refresh token
  */
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

export { registerUser, loginUser, logoutUser };
