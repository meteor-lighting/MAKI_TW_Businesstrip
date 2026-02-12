/**
 * Authentication Logic
 */

function handleSignUp(payload) {
  // payload: { username, password, email }
  const lock = LockService.getScriptLock();
  // Wait up to 10 seconds for lock
  if (lock.tryLock(10000)) {
    try {
      const sheet = getSheet('Member');
      const data = getDataRows('Member'); // 2D array
      
      // Check username uniqueness (Column Index 1: Name)
      const exists = data.some(row => row[1] === payload.username);
      if (exists) {
        return { status: 'error', message: '此用戶名稱已存在！' };
      }

      // Validation
      if (!payload.password || payload.password.length < 8) {
        return { status: 'error', message: '用戶密碼必須包含英數字至少8位！' };
      }
      
      // TODO: strict email validation if needed
      
      // Generate ID
      let lastId = 0;
      if (data.length > 0) {
        const ids = data.map(row => parseInt(row[0], 10)).filter(id => !isNaN(id));
        if (ids.length > 0) {
          lastId = Math.max(...ids);
        }
      }
      const newId = String(lastId + 1).padStart(6, '0');
      
      // Hash Password
      const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload.password)
        .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join(''); // simple hex

      // Save
      // Columns: 用戶編號, 用戶名稱, 用戶密碼, 用戶電郵地址, 建立時間
      sheet.appendRow([
        newId,
        payload.username,
        passwordHash,
        payload.email,
        new Date()
      ]);

      return { status: 'success', message: '用戶註冊成功！', userId: newId };

    } catch (e) {
      throw e;
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'Server busy, please try again.' };
  }
}

function handleSignIn(payload) {
  // payload: { username, password }
  const sheetData = sheetDataToJson('Member');
  const user = sheetData.find(u => u['用戶名稱'] === payload.username);
  
  if (!user) {
    return { status: 'error', message: '此用戶名稱不存在！' };
  }

  const inputHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload.password)
        .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');

  if (user['用戶密碼'] !== inputHash) {
    return { status: 'error', message: '密碼錯誤！' };
  }

  // Login successful
  return { 
    status: 'success', 
    token: 'mock-token-' + new Date().getTime(), // In real app, use proper session
    user: {
      id: user['用戶編號'],
      name: user['用戶名稱'],
      email: user['用戶電郵地址']
    }
  };
}

function handleForgotPassword(payload) {
  // payload: { email }
  const email = payload.email;
  const lock = LockService.getScriptLock();
  
  if (lock.tryLock(10000)) {
    try {
      const sheet = getSheet('Member');
      const data = sheet.getDataRange().getValues(); // Get all data
      
      // Headers are in row 1 (index 0). Data starts row 2 (index 1).
      // Columns: 用戶編號(0), 用戶名稱(1), 用戶密碼(2), 用戶電郵地址(3)
      
      let rowIndex = -1;
      let userName = '';
      
      // Find user by email
      for (let i = 1; i < data.length; i++) {
        if (data[i][3] === email) {
          rowIndex = i + 1; // 1-based row index
          userName = data[i][1];
          break;
        }
      }
      
      if (rowIndex === -1) {
        return { status: 'error', message: '找不到此用戶電郵地址！' };
      }
      
      // Generate new password
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let newPassword = "";
      for (let i = 0; i < 8; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Hash new password
      const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, newPassword)
        .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
        
      // Update password in sheet (Column 3 corresponds to index 2, but getRange uses 1-based indexing)
      // Password column is C (3rd column)
      sheet.getRange(rowIndex, 3).setValue(passwordHash);
      
      // Send Email
      MailApp.sendEmail({
        to: email,
        subject: 'Business Travel Expense Report - Password Reset (密碼重設)',
        body: `Dear ${userName},\n\nYour password has been reset.\nNew Password: ${newPassword}\n\nPlease log in and change your password if needed.\n\nBest Regards,\nAdmin`
      });
      
      return { status: 'success', message: '重設密碼信件已寄出！' };
      
    } catch (e) {
      throw e;
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'Server busy' };
  }
}

function handleChangePassword(payload) {
  // payload: { username, oldPassword, newPassword }
  const username = payload.username;
  const oldPassword = payload.oldPassword;
  const newPassword = payload.newPassword;
  
  const lock = LockService.getScriptLock();
  
  if (lock.tryLock(10000)) {
    try {
      const sheet = getSheet('Member');
      const data = sheet.getDataRange().getValues();
      
      let rowIndex = -1;
      let storedPasswordHash = '';
      
      // Find user
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === username) {
          rowIndex = i + 1;
          storedPasswordHash = data[i][2];
          break;
        }
      }
      
      if (rowIndex === -1) {
        return { status: 'error', message: '找不到此用戶！' };
      }
      
      // Verify Old Password
      const oldPasswordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, oldPassword)
        .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
        
      if (oldPasswordHash !== storedPasswordHash) {
        return { status: 'error', message: '舊密碼錯誤！' };
      }
      
      // Update New Password
      const newPasswordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, newPassword)
        .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
        
      sheet.getRange(rowIndex, 3).setValue(newPasswordHash);
      
      return { status: 'success', message: '密碼修改成功！' };
      
    } catch (e) {
      throw e;
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'Server busy' };
  }
}
