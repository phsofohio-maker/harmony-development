const patients = [
    {
      id: 1,
      name: 'John Doe',
      certification: 'Certified',
      lastAppointment: '2023-11-15',
      nextAppointment: '2024-05-15',
      certificationPercent: 100,
    },
    {
      id: 2,
      name: 'Jane Smith',
      certification: 'Pending',
      lastAppointment: '2023-12-01',
      nextAppointment: '2024-06-01',
      certificationPercent: 50,
    },
    {
        id: 3,
        name: 'Bob Johnson',
        certification: 'Not Certified',
        lastAppointment: '2023-10-20',
        nextAppointment: '2024-04-20',
        certificationPercent: 0,
      },
  ];
  
  export const getPatients = () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(patients);
      }, 500);
    });
  };
  