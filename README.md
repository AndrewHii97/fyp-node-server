# FypExpressServer
Final Year Project Express Server
## API 
## **ALL** /Device/* 
All request going through this path need to submit "device_name" & "password" 
## **POST** /Device/Upload-Photo
- Device upload photos to be stored in the AWS S3
- Update database PHOTOS table 
## **GET** /Device/Analyse-Photo/:photo-path 
- Analyse Photo in AWS S3 
## **POST** /Device/find_faces
- Use AWS Rekognition to determine any recognized face



