function convertToDate(dateString) {
    // Check if the string matches the format yyyy-mm-dd
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
        throw new Error("Invalid date format");
    }

    // Check if the date is valid
    const dateParts = dateString.split("-");
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);

    const date = new Date(year, month - 1, day);
    const isValidDate =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;

    if (!isValidDate) {
        throw new Error("Invalid date");
    }

    return date;
}


module.exports = { convertToDate }