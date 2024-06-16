import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const extractPublicId = (publicUrl) => {
  const pathSegments = publicUrl.split("/");
  const versionIndex = pathSegments.findIndex((segment) =>
    segment.startsWith("v")
  );
  if (versionIndex !== -1) pathSegments.splice(versionIndex, 1);

  const publicIdWithExtension = pathSegments
    .slice(pathSegments.indexOf("upload") + 1)
    .join("/");

  const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, "");
  return publicId;
};

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // Successfully upload file to the cloudinary
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // Unlink locally stored file from server
    return null;
  }
};

const deleteOnCloudinary = async (publicUrl) => {
  try {
    if (!publicUrl) return null;

    const publicId = extractPublicId(publicUrl);

    // Delete the file on cloudinary

    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    return response;
  } catch (error) {
    console.error("Deletion Error: ", error);
    return null;
  }
};

export { uploadOnCloudinary, deleteOnCloudinary };
