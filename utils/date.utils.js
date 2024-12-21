export const formatDurationInShort = (days, prefix) => {
    let dateDescription = ""; 
    if (days >= 365) {
      const years = days / 365;
      dateDescription = years.toFixed(years % 1 === 0 ? 0 : 1) + "y"; // "1y" or "2.1y"
    } else if (days >= 30) {
      const months = days / 30;
      dateDescription = Math.round(months) + "m"; // "13m"
    } else {
        dateDescription = days + "d"; // Fallback for small durations
    }
    return  prefix + " " + dateDescription;
  }

  export const getLastDurationDescription = (startDate, endDate) =>{
    const diffInMS = endDate - startDate;
    const days = Math.floor(diffInMS / (1000 * 60 * 60 * 24));
    const durationDescription = formatDurationInShort(days, "Compare with last"); // compare with last 1m or 1y etc
    return durationDescription;
  }
  
  export const getLastDurationDates = (startDate, endDate) => {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      throw new Error("Both startDate and endDate must be Date objects");
    }
    const duration = endDate - startDate; // Get the duration in milliseconds
    const newEndDate = new Date(startDate); // Previous period's end date is the current start date
    const newStartDate = new Date(startDate.getTime() - duration); // Calculate previous period's start date
  
    return { startDate: newStartDate, endDate: newEndDate };
  };
  

 export const myViewFilter = (user, opportunity) => {
    console.log(user.solution)
    const mySolution = user.solution
    const myTerritory = user.territory
    const myIndustry = user.industry
    
    const solutionCheck =  mySolution.includes(opportunity?.solution?.toString());
    const industryCheck =  myIndustry.includes(opportunity?.client?.industry?.toString());
    const territoryCheck = myTerritory.includes(opportunity?.client?.territory?.toString());
    
    console.log("checks : " , solutionCheck , industryCheck , territoryCheck)

    return (
      solutionCheck && industryCheck && territoryCheck
    )
 }

 function getQuarterDates(year) {
  // Helper function to create a date in ISO format
  const formatDate = (year, month, day) =>
    new Date(Date.UTC(year, month - 1, day)).toISOString().split("T")[0];

  // Define quarters with their respective start and end months and days
  return {
    q1: { startDate: formatDate(year, 1, 1), endDate: formatDate(year, 3, 31) },
    q2: { startDate: formatDate(year, 4, 1), endDate: formatDate(year, 6, 30) },
    q3: { startDate: formatDate(year, 7, 1), endDate: formatDate(year, 9, 30) },
    q4: { startDate: formatDate(year, 10, 1), endDate: formatDate(year, 12, 31) },
  };
}

// Example usage
const quarterDates = getQuarterDates(2024);
console.log(quarterDates);
