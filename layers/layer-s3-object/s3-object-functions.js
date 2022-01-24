const AWS = require('aws-sdk');
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

exports.returnStringFromS3Object = async (bucket, key) => {

    let params = {
        Bucket: bucket,
        Key: key
    };

    let data;

    try {
        data = await s3.getObject(params).promise();
    } catch (err) {
        console.log("No object found object: ", err);
        //throw err;
        return false;
    }

    return new Buffer.from(data.Body).toString("utf8");
}

exports.putJsonObjectIntoS3 = async (bucket, key, obj) => {

    let putParams = {
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(obj),
        ContentType: 'application/json'
    };

    let result;

    try {
        let result = await s3.putObject(putParams).promise();
    } catch (err) {
        console.log("No object found object: ", err);
        //throw err;
        return false;
    }

    return result;

}
