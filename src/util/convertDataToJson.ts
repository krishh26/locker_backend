export function convertDataToJson(data) {

    const obj: any = {};
    let i = 0;

    for (i = 0; i < 4; i++) {
        let cleanedStr = data[i].replace(/\n/g, ',');
        cleanedStr = cleanedStr.replace(/,{2,}/g, ',').replace(/(^,)|(,$)/g, '');
        const value = cleanedStr.split(":");
        if (i === 0) {
            obj[value[0]] = value[1]?.split(",")[1];
            obj.course_code = value[1]?.split(",")[2];
        } else {
            obj[value[0]] = value[1]?.split(",")[1];
        }
    }

    function convertData(data) {
        // Join all parts into a single string
        const joinedString = data.join(' ')
            // Replace newlines with spaces
            .replace(/\n+/g, ' ')
            // Replace multiple consecutive commas with a single comma
            .replace(/,,+/g, ',')
            // Remove extra spaces around commas
            .replace(/,\s*,/g, ',')
            .trim();

        // Regular expression to match digit patterns (e.g., 1., 1.1, 2.)
        const regex = /(?=\d+\.\d*|^\d+\.)/;

        // Split the string using the regular expression
        const sections = joinedString.split(regex).filter(section => section.trim() !== "");

        // Initialize the result object
        const result = {};
        let oldKey = '-1';

        // Process each section
        sections.forEach(section => {
            // Remove leading/trailing commas and trim extra spaces
            section = section.replace(/^,+|,+$/g, '').trim();
            // Replace remaining commas with spaces
            section = section.replace(/,+/g, ' ');

            // Extract the section number and text
            const parts = section.split(' ').filter(part => part.trim() !== '');
            const key = parts[0].trim();
            const text = parts.slice(1).join(' ').trim();

            if (key.includes(oldKey)) {
                result[oldKey].subTopics.push({
                    number: key,
                    text: text
                });
            } else {
                result[key] = { text: text, subTopics: [] };
                oldKey = key;
            }
        });

        const output = Object.entries(result).map(([key, value]: any) => ({
            [key]: value.text,
            subTopics: value.subTopics
        }));

        return output;
    }

    const unit_details = convertData(data.splice(5));
    return { course_details: obj, unit_details }
}