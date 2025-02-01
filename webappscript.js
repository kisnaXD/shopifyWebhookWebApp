    function updateValue(id, change, maxValue) {
        let element = document.getElementById(id);
        let currentValue = parseInt(element.innerText);
        let newValue = currentValue + change;
        if (newValue >= 0 && newValue <= maxValue) {
            element.innerText = newValue;
        }
    }

    function refreshTable(accessCode, ch) {
        fetch(`https://vades.in/verify-access-code`, {
            method: "POST",
            headers: {
                'Content-Type': "application/json",
            },
            body: JSON.stringify({
                accessCode: accessCode
            }),
        })
            .then(response => response.json())
            .then(data => {
                console.log("Fine")
                console.log(data)
                if (data.status === "success") {


                    const accessCodePara = document.querySelector(".accessCodePara");
                    console.log(data.tickets)
                    if(((data.tickets.length === 1 && data.tickets[0].quantity === 0) || (data.tickets.length>1 && data.tickets[0].quantity === 0 && data.tickets[1].quantity === 0)) && ch === false) {
                        document.getElementById("expireModal").style.display = "flex";
                    } else {
                        accessCodePara.innerText = `Welcome : ${data.name} \nAccess Code : ${accessCode}`

                        accessCodePara.setAttribute("data-access-code", accessCode);
                        accessCodePara.setAttribute("data-name", data.name);
                        data.tickets.forEach(ticket => {
                            const ticketName = ticket.name.toLowerCase().replace(/\s+/g, '-'); 
                            const quantity = ticket.quantity;
                            const availableElement = document.getElementById(ticketName + '-available');
                            if (availableElement) {
                                availableElement.innerText = quantity;
                            }
                            const valueElement = document.getElementById(ticketName + '-value');
                            if (valueElement) {
                                valueElement.innerText = Math.min(quantity, parseInt(valueElement.innerText));
                            }
                            const btnPlus = document.getElementById(ticketName + '-plus');
                            const btnMinus = document.getElementById(ticketName + '-minus');
                            if (btnPlus && btnMinus) {
                                const maxValue = quantity;

                                btnPlus.onclick = function() {
                                    updateValue(ticketName + '-value', 1, maxValue);
                                };
                                btnMinus.onclick = function() {
                                    updateValue(ticketName + '-value', -1, maxValue);
                                };
                            }
                        });
                    }
                } else {
                    console.log(data)
                    console.log("Ok")
                    document.getElementById("modal").style.display = "flex";
                }
            })
            .catch(error => {
                document.getElementById("modal").style.display = "flex";
            });
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("accessCodeSubmit").addEventListener("click", function () {
            const accessCode = document.getElementById("accessCodeInput").value.trim();
        
            if (!accessCode) {
                alert("Please enter an access code.");
                return;
            }
            
            refreshTable(accessCode, false);
            
        });
        document.getElementById("availableSubmit").addEventListener("click", () => {
            const accessCodePara = document.querySelector(".accessCodePara");
            const accessCode = accessCodePara.getAttribute("data-access-code"); // Retrieve stored access code
            const personName = accessCodePara.getAttribute("data-name"); // Retrieve stored person's name

            if (!accessCode) {
                alert("No valid access code found. Please verify your access code first.");
                return;
            }
            const generalMaleValue = parseInt(document.getElementById("general-male-entry-value").innerText);
            const generalFemaleValue = parseInt(document.getElementById("general-female-entry-value").innerText);
            if(generalMaleValue === 0 && generalFemaleValue === 0) {
                document.getElementById('entryModal').style.display = 'flex';
            } else {
                const requestBody = {
                    accessCode: accessCode,
                    generalMaleEntry: generalMaleValue,
                    generalFemaleEntry: generalFemaleValue
                };

                fetch(`https://vades.in/add-entry`, {
                    method: "POST",
                    headers: {
                        'Content-Type': "application/json",
                    },
                    body: JSON.stringify(requestBody),
                })
                .then(response => response.json()) 
                .then(data => {
                    console.log(data);
                    if (data.status === "success") {
                        const successText = document.getElementById("successText");
                        successText.innerHTML = `
                            <p style="font-family: 'Montserrat', sans-serif;"><strong>Confirmed By:</strong> ${personName}</p>
                            <br>
                            <p style="font-family: 'Montserrat', sans-serif;"><strong>Confirmed Entries:</strong></p>
                            <ul style="list-style-type: none; font-family: 'Montserrat', sans-serif;">
                                <li>General Male Entry: ${generalMaleValue}</li>
                                <li>General Female Entry: ${generalFemaleValue}</li>
                            </ul>
                        `;
                        refreshTable(accessCode, true);
                        document.getElementById("successModal").style.display = "flex"; 
                    } else {
                        document.getElementById("modal").style.display = "flex";
                    }
                })
                .catch(error => {
                    console.error(error);
                    document.getElementById("modal").style.display = "flex";
                });
            }
        });
        document.getElementById("closeModal").addEventListener("click", () => {
            document.getElementById("modal").style.display = "none";
        });
        document.getElementById("closeEntryModal").addEventListener("click", () => {
            document.getElementById("entryModal").style.display = "none";
        });
        document.getElementById("closeSuccessModal").addEventListener("click", () => {
            document.getElementById("successModal").style.display = "none";
            window.location.href = window.location.href;
        });
        document.getElementById("closeExpireModal").addEventListener("click", () => {
            document.getElementById("expireModal").style.display = "none";
        });
        window.addEventListener("click", (event) => {
            const modal = document.getElementById("modal");
            const successModal = document.getElementById("successModal");
            const entryModal = document.getElementById("entryModal");
            const expireModal = document.getElementById("expireModal");

            if (event.target === modal) {  
                modal.style.display = "none";
            }

            if (event.target === successModal) {  
                successModal.style.display = "none";
            }

            if(event.target === entryModal) {
                entryModal.style.display = 'none';
            }

            if (event.target === expireModal) {  
                modal.style.display = "none";
            }
        });
    });
