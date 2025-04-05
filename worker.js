// TUI Portfolio API
// 支持照片元数据同步和文件上传的Worker代码

// 导入验证模块
import {
  handleGetMetadata,
  handleCheckFileIntegrity,
  handleGetPhotoCount,
  handleCheckPhotoExists,
  handleGetR2ObjectCount,
  handleVerifyPhotoFiles,
  handleBatchVerifyPhotos
} from './verification.js';

export default {
  async fetch(request, env, ctx) {
    try {
      // 启用CORS
      if (request.method === 'OPTIONS') {
        return handleOptions(request);
      }

      // 解析URL和路径
      const url = new URL(request.url);
      const path = url.pathname;

      // 路由请求
      if (path === '/api/photos' && request.method === 'GET') {
        return await handleGetPhotos(request, env);
      } else if (path.match(/^\/api\/photos\/\w+$/) && request.method === 'GET') {
        const id = path.split('/').pop();
        return await handleGetPhoto(request, env, id);
      } else if (path === '/api/hello' && request.method === 'GET') {
        return await handleHelloWorld(request, env);
      } else if (path === '/api/photos' && request.method === 'POST') {
        return await handleAddPhoto(request, env);
      } else if (path.match(/^\/api\/photos\/\w+$/) && request.method === 'PUT') {
        const id = path.split('/').pop();
        return await handleUpdatePhoto(request, env, id);
      } else if (path.match(/^\/api\/photos\/\w+$/) && request.method === 'DELETE') {
        const id = path.split('/').pop();
        return await handleDeletePhoto(request, env, id);
      } else if (path === '/api/sync' && request.method === 'POST') {
        return await handleSyncPhotos(request, env);
      } else if (path === '/api/upload' && request.method === 'POST') {
        return await handleFileUpload(request, env);
      } else if (path.match(/^\/api\/files\/\w+.*$/) && request.method === 'GET') {
        const filePath = path.replace('/api/files/', '');
        return await handleGetFile(request, env, filePath);
      } else if (path === '/api/clear' && request.method === 'POST') {
        return await handleClearAll(request, env);
      } 
      // 验证相关API路由
      else if (path.match(/^\/api\/metadata\/\w+$/) && request.method === 'GET') {
        const id = path.split('/').pop();
        return await handleGetMetadata(request, env, id);
      } else if (path.match(/^\/api\/files\/integrity\/\w+$/) && request.method === 'GET') {
        const id = path.split('/').pop();
        return await handleCheckFileIntegrity(request, env, id);
      } else if (path === '/api/photos/count' && request.method === 'GET') {
        return await handleGetPhotoCount(request, env);
      } else if (path.match(/^\/api\/photos\/\w+$/) && request.method === 'HEAD') {
        const id = path.split('/').pop();
        return await handleCheckPhotoExists(request, env, id);
      } else if (path === '/api/files/count' && request.method === 'GET') {
        return await handleGetR2ObjectCount(request, env);
      } else if (path.match(/^\/api\/verify\/\w+$/) && request.method === 'GET') {
        const id = path.split('/').pop();
        return await handleVerifyPhotoFiles(request, env, id);
      } else if (path === '/api/batch-verify' && request.method === 'POST') {
        return await handleBatchVerifyPhotos(request, env);
      }
      else {
        return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Server error:', error);
      return new Response('Server error: ' + error.message, { status: 500 });
    }
  }
};

// 处理CORS预检请求
function handleOptions(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// 返回JSON响应
function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 处理获取照片列表
async function handleGetPhotos(request, env) {
  try {
    // 获取查询参数
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // 查询数据库
    const stmt = env.data.prepare(
      `SELECT * FROM Photos ORDER BY DateTimeOriginal DESC LIMIT ? OFFSET ?`
    );
    const result = await stmt.bind(limit, offset).all();
    
    return jsonResponse(result.results);
  } catch (error) {
    console.error('Failed to get photos:', error);
    return new Response('Failed to get photos: ' + error.message, { status: 500 });
  }
}

// 处理获取单张照片
async function handleGetPhoto(request, env, id) {
  try {
    const stmt = env.data.prepare(`SELECT * FROM Photos WHERE Id = ?`);
    const result = await stmt.bind(id).first();
    
    if (!result) {
      return new Response('Photo not found', { status: 404 });
    }
    
    return jsonResponse(result);
  } catch (error) {
    console.error('Failed to get photo:', error);
    return new Response('Failed to get photo: ' + error.message, { status: 500 });
  }
}

// 处理添加照片
async function handleAddPhoto(request, env) {
  try {
    const data = await request.json();
    
    // 验证必要字段
    if (!data.id || !data.title || !data.path) {
      return new Response('Missing required fields', { status: 400 });
    }
    
    // 插入照片元数据
    const stmt = env.data.prepare(`
      INSERT INTO Photos (
        Id, Title, Path, ThumbnailPath100, ThumbnailPath350, StarRating, 
        Country, Area, Locality, DateTimeOriginal, AddTimestamp, 
        LensModel, Model, ExposureTime, FNumber, FocalLenIn35mmFilm, 
        FocalLength, ISOSPEEDRatings, Altitude, Latitude, Longitude, 
        ObjectName, Caption
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      data.id, data.title, data.path, data.thumbnailPath100, data.thumbnailPath350, 
      data.starRating, data.country, data.area, data.locality, data.dateTimeOriginal, 
      data.addTimestamp, data.lensModel, data.model, data.exposureTime, data.fNumber, 
      data.focalLenIn35mmFilm, data.focalLength, data.isoSPEEDRatings, data.altitude, 
      data.latitude, data.longitude, data.objectName, data.caption
    ).run();
    
    return new Response('Photo added successfully', { status: 201 });
  } catch (error) {
    console.error('Failed to add photo:', error);
    return new Response('Failed to add photo: ' + error.message, { status: 500 });
  }
}

// 处理更新照片
async function handleUpdatePhoto(request, env, id) {
  try {
    const data = await request.json();
    
    // 检查照片是否存在
    const checkStmt = env.data.prepare(`SELECT Id FROM Photos WHERE Id = ?`);
    const photo = await checkStmt.bind(id).first();
    
    if (!photo) {
      return new Response('Photo not found', { status: 404 });
    }
    
    // 更新照片元数据
    const stmt = env.data.prepare(`
      UPDATE Photos SET
        Title = ?, Path = ?, ThumbnailPath100 = ?, ThumbnailPath350 = ?, 
        StarRating = ?, Country = ?, Area = ?, Locality = ?, 
        DateTimeOriginal = ?, AddTimestamp = ?, LensModel = ?, 
        Model = ?, ExposureTime = ?, FNumber = ?, FocalLenIn35mmFilm = ?, 
        FocalLength = ?, ISOSPEEDRatings = ?, Altitude = ?, 
        Latitude = ?, Longitude = ?, ObjectName = ?, Caption = ?
      WHERE Id = ?
    `);
    
    await stmt.bind(
      data.title, data.path, data.thumbnailPath100, data.thumbnailPath350, 
      data.starRating, data.country, data.area, data.locality, data.dateTimeOriginal, 
      data.addTimestamp, data.lensModel, data.model, data.exposureTime, data.fNumber, 
      data.focalLenIn35mmFilm, data.focalLength, data.isoSPEEDRatings, data.altitude, 
      data.latitude, data.longitude, data.objectName, data.caption, id
    ).run();
    
    return new Response('Photo updated successfully', { status: 200 });
  } catch (error) {
    console.error('Failed to update photo:', error);
    return new Response('Failed to update photo: ' + error.message, { status: 500 });
  }
}

// 处理删除照片
async function handleDeletePhoto(request, env, id) {
  try {
    // 检查照片是否存在
    const checkStmt = env.data.prepare(`SELECT Path, ThumbnailPath100, ThumbnailPath350 FROM Photos WHERE Id = ?`);
    const photo = await checkStmt.bind(id).first();
    
    if (!photo) {
      return new Response('Photo not found', { status: 404 });
    }
    
    // 删除存储桶中的文件
    try {
      if (photo.Path) {
        await env.images.delete(photo.Path);
      }
      if (photo.ThumbnailPath100) {
        await env.images.delete(photo.ThumbnailPath100);
      }
      if (photo.ThumbnailPath350) {
        await env.images.delete(photo.ThumbnailPath350);
      }
    } catch (fileError) {
      console.error('Error deleting files:', fileError);
      // 继续执行，即使文件删除失败
    }
    
    // 删除照片元数据
    const stmt = env.data.prepare(`DELETE FROM Photos WHERE Id = ?`);
    await stmt.bind(id).run();
    
    return new Response('Photo deleted successfully', { status: 200 });
  } catch (error) {
    console.error('Failed to delete photo:', error);
    return new Response('Failed to delete photo: ' + error.message, { status: 500 });
  }
}

// 处理批量同步照片
async function handleSyncPhotos(request, env) {
  try {
    const data = await request.json();
    
    if (!Array.isArray(data.photos)) {
      return new Response('Invalid data format: photos should be an array', { status: 400 });
    }
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    // 开始批量处理
    for (const photo of data.photos) {
      try {
        // 处理字段，确保没有undefined值
        const safePhoto = {
          id: photo.id || '',
          title: photo.title || '',
          path: photo.path || '',
          thumbnailPath100: photo.thumbnailPath100 || '',
          thumbnailPath350: photo.thumbnailPath350 || '',
          starRating: photo.starRating || 0,
          country: photo.country || '',
          area: photo.area || '',
          locality: photo.locality || '',
          dateTimeOriginal: photo.dateTimeOriginal || '',
          addTimestamp: photo.addTimestamp || '',
          lensModel: photo.lensModel || '',
          model: photo.model || '',
          exposureTime: photo.exposureTime || 0,
          fNumber: photo.fNumber || 0,
          focalLenIn35mmFilm: photo.focalLenIn35mmFilm || 0,
          focalLength: photo.focalLength || 0,
          isoSPEEDRatings: photo.isoSPEEDRatings || 0,
          altitude: photo.altitude || 0,
          latitude: photo.latitude || 0,
          longitude: photo.longitude || 0,
          objectName: photo.objectName || '',
          caption: photo.caption || ''
        };
        
        // 检查照片是否已存在
        const checkStmt = env.data.prepare(`SELECT Id FROM Photos WHERE Id = ?`);
        const existingPhoto = await checkStmt.bind(safePhoto.id).first();
        
        if (existingPhoto) {
          // 更新照片
          const updateStmt = env.data.prepare(`
            UPDATE Photos SET
              Title = ?, Path = ?, ThumbnailPath100 = ?, ThumbnailPath350 = ?, 
              StarRating = ?, Country = ?, Area = ?, Locality = ?, 
              DateTimeOriginal = ?, AddTimestamp = ?, LensModel = ?, 
              Model = ?, ExposureTime = ?, FNumber = ?, FocalLenIn35mmFilm = ?, 
              FocalLength = ?, ISOSPEEDRatings = ?, Altitude = ?, 
              Latitude = ?, Longitude = ?, ObjectName = ?, Caption = ?
            WHERE Id = ?
          `);
          
          await updateStmt.bind(
            safePhoto.title, safePhoto.path, safePhoto.thumbnailPath100, safePhoto.thumbnailPath350, 
            safePhoto.starRating, safePhoto.country, safePhoto.area, safePhoto.locality, safePhoto.dateTimeOriginal, 
            safePhoto.addTimestamp, safePhoto.lensModel, safePhoto.model, safePhoto.exposureTime, safePhoto.fNumber, 
            safePhoto.focalLenIn35mmFilm, safePhoto.focalLength, safePhoto.isoSPEEDRatings, safePhoto.altitude, 
            safePhoto.latitude, safePhoto.longitude, safePhoto.objectName, safePhoto.caption, safePhoto.id
          ).run();
        } else {
          // 插入新照片
          const insertStmt = env.data.prepare(`
            INSERT INTO Photos (
              Id, Title, Path, ThumbnailPath100, ThumbnailPath350, StarRating, 
              Country, Area, Locality, DateTimeOriginal, AddTimestamp, 
              LensModel, Model, ExposureTime, FNumber, FocalLenIn35mmFilm, 
              FocalLength, ISOSPEEDRatings, Altitude, Latitude, Longitude, 
              ObjectName, Caption
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          await insertStmt.bind(
            safePhoto.id, safePhoto.title, safePhoto.path, safePhoto.thumbnailPath100, safePhoto.thumbnailPath350, 
            safePhoto.starRating, safePhoto.country, safePhoto.area, safePhoto.locality, safePhoto.dateTimeOriginal, 
            safePhoto.addTimestamp, safePhoto.lensModel, safePhoto.model, safePhoto.exposureTime, safePhoto.fNumber, 
            safePhoto.focalLenIn35mmFilm, safePhoto.focalLength, safePhoto.isoSPEEDRatings, safePhoto.altitude, 
            safePhoto.latitude, safePhoto.longitude, safePhoto.objectName, safePhoto.caption
          ).run();
        }
        
        results.success++;
      } catch (error) {
        console.error('Error processing photo:', error, 'Photo:', photo);
        results.failed++;
        results.errors.push({
          id: photo.id || 'unknown',
          error: error.message
        });
      }
    }
    
    return jsonResponse(results);
  } catch (error) {
    console.error('Failed to sync photos:', error);
    return new Response('Failed to sync photos: ' + error.message, { status: 500 });
  }
}

// 处理文件上传
async function handleFileUpload(request, env) {
  try {
    // 检查是否为multipart/form-data类型
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response('Content-Type must be multipart/form-data', { status: 400 });
    }
    
    const formData = await request.formData();
    const file = formData.get('file');
    const path = formData.get('path');
    
    if (!file || !path) {
      return new Response('Missing file or path', { status: 400 });
    }
    
    if (!(file instanceof File)) {
      return new Response('Invalid file object', { status: 400 });
    }
    
    // 上传文件到R2存储桶
    await env.images.put(path, file);
    
    return new Response(JSON.stringify({
      success: true,
      path: path,
      size: file.size,
      type: file.type
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    return new Response('File upload failed: ' + error.message, { status: 500 });
  }
}

// 获取存储的文件
async function handleGetFile(request, env, path) {
  try {
    const object = await env.images.get(path);
    
    if (!object) {
      return new Response('File not found', { status: 404 });
    }
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    return new Response(object.body, {
      headers
    });
  } catch (error) {
    console.error('Failed to get file:', error);
    return new Response('Failed to get file: ' + error.message, { status: 500 });
  }
}

// 处理CORS预检请求
function handleOptions(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// 返回JSON响应
function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 处理清空所有数据的请求
async function handleClearAll(request, env) {
  try {
    console.log("清空所有数据请求已接收");
    
    // 获取安全令牌 - 简单实现，生产环境应更严格
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    // 验证token - 这里使用简单的硬编码值，仅用于测试
    if (token !== "tui-clear-all-data") {
      return new Response('未授权的访问', { status: 401 });
    }
    
    // 1. 清空数据库
    console.log("正在清空数据库...");
    const dbResult = await clearDatabase(env);
    
    // 2. 清空存储桶
    console.log("正在清空存储桶...");
    const r2Result = await clearStorage(env);
    
    return new Response(JSON.stringify({
      success: true,
      message: "所有数据已清空",
      database: dbResult,
      storage: r2Result
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error("清空数据时出错:", error);
    return new Response('清空数据失败: ' + error.message, { status: 500 });
  }
}

// 清空数据库表
async function clearDatabase(env) {
  try {
    // 首先保存表结构
    const tableInfoStmt = env.data.prepare("PRAGMA table_info(Photos)");
    const tableInfo = await tableInfoStmt.all();
    
    // 删除表中的所有记录
    const deleteStmt = env.data.prepare("DELETE FROM Photos");
    const result = await deleteStmt.run();
    
    return {
      success: true,
      recordsDeleted: result.count,
      message: "数据库表已清空"
    };
  } catch (error) {
    console.error("清空数据库时出错:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 清空存储桶
async function clearStorage(env) {
  try {
    // 1. 列出所有对象
    let deletedCount = 0;
    let continuationToken = null;
    
    // 最多清理1000个对象，避免操作过大
    const maxDeleteCount = 1000;
    
    do {
      const objects = await env.images.list({ limit: 100, cursor: continuationToken });
      
      // 如果没有对象，退出循环
      if (!objects.objects || objects.objects.length === 0) {
        break;
      }
      
      // 删除当前批次中的所有对象
      for (const object of objects.objects) {
        await env.images.delete(object.key);
        deletedCount++;
        
        // 限制单次操作数量
        if (deletedCount >= maxDeleteCount) {
          break;
        }
      }
      
      // 获取下一页的token
      continuationToken = objects.cursor;
      
      // 如果达到了删除上限，退出循环
      if (deletedCount >= maxDeleteCount) {
        break;
      }
    } while (continuationToken);
    
    return {
      success: true,
      objectsDeleted: deletedCount,
      message: deletedCount >= maxDeleteCount ? 
        `已删除${deletedCount}个对象(达到上限)` : 
        `已删除所有${deletedCount}个对象`
    };
  } catch (error) {
    console.error("清空存储桶时出错:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 以下是新增的同步验证API功能

// 处理获取照片元数据
async function handleGetMetadata(request, env, id) {
  try {
    const stmt = env.data.prepare(`
      SELECT Id, Title, Path, DateTimeOriginal, Latitude, Longitude, ObjectName
      FROM Photos 
      WHERE Id = ?
    `);
    const result = await stmt.bind(id).first();
    
    if (!result) {
      return new Response(JSON.stringify({ 
        error: 'Photo metadata not found'
      }), { 
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return jsonResponse({ metadata: result });
  } catch (error) {
    console.error('Failed to get metadata:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to retrieve metadata: ' + error.message 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 检查照片文件完整性
async function handleCheckFileIntegrity(request, env, id) {
  try {
    // 首先获取照片路径信息
    const stmt = env.data.prepare(`
      SELECT Path, ThumbnailPath100, ThumbnailPath350
      FROM Photos 
      WHERE Id = ?
    `);
    const photo = await stmt.bind(id).first();
    
    if (!photo) {
      return new Response(JSON.stringify({ 
        error: 'Photo not found'
      }), { 
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // 检查原始文件是否存在
    let originalExists = false;
    let originalSize = 0;
    if (photo.Path) {
      try {
        const originalObject = await env.images.head(photo.Path);
        if (originalObject) {
          originalExists = true;
          originalSize = originalObject.size;
        }
      } catch (e) {
        console.log(`原始文件不存在: ${photo.Path}`);
      }
    }
    
    // 检查缩略图是否存在
    let thumbnail100Exists = false;
    let thumbnail100Size = 0;
    if (photo.ThumbnailPath100) {
      try {
        const thumb100Object = await env.images.head(photo.ThumbnailPath100);
        if (thumb100Object) {
          thumbnail100Exists = true;
          thumbnail100Size = thumb100Object.size;
        }
      } catch (e) {
        console.log(`缩略图100不存在: ${photo.ThumbnailPath100}`);
      }
    }
    
    let thumbnail350Exists = false;
    let thumbnail350Size = 0;
    if (photo.ThumbnailPath350) {
      try {
        const thumb350Object = await env.images.head(photo.ThumbnailPath350);
        if (thumb350Object) {
          thumbnail350Exists = true;
          thumbnail350Size = thumb350Object.size;
        }
      } catch (e) {
        console.log(`缩略图350不存在: ${photo.ThumbnailPath350}`);
      }
    }
    
    // 判断文件完整性
    let isIntact = originalExists && thumbnail100Exists && thumbnail350Exists;
    let issues = [];
    
    if (!originalExists) {
      issues.push('original_missing');
    } else if (originalSize < 10000) { // 假设原始照片至少10KB
      issues.push('original_too_small');
      isIntact = false;
    }
    
    if (!thumbnail100Exists) {
      issues.push('thumbnail100_missing');
    }
    
    if (!thumbnail350Exists) {
      issues.push('thumbnail350_missing');
    }
    
    return jsonResponse({
      integrity: {
        isIntact,
        issues,
        files: {
          original: originalExists ? { exists: true, size: originalSize } : { exists: false },
          thumbnail100: thumbnail100Exists ? { exists: true, size: thumbnail100Size } : { exists: false },
          thumbnail350: thumbnail350Exists ? { exists: true, size: thumbnail350Size } : { exists: false }
        }
      }
    });
  } catch (error) {
    console.error('Failed to check file integrity:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to check file integrity: ' + error.message 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 获取照片总数
async function handleGetPhotoCount(request, env) {
  try {
    const countStmt = env.data.prepare(`SELECT COUNT(*) as count FROM Photos`);
    const result = await countStmt.first();
    
    const count = result ? result.count : 0;
    
    return jsonResponse({ count });
  } catch (error) {
    console.error('Failed to count photos:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to count photos: ' + error.message 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 检查照片是否存在（从R2存储桶中检查）
async function handleCheckPhotoExists(request, env, id) {
  try {
    console.log(`检查照片ID: ${id} 是否存在`);
    
    // 构建可能的文件路径 - 注意这里添加了.jpg后缀
    const photoPath = `photos/${id}.jpg`;
    
    // 检查原始照片是否存在
    try {
      const photoObject = await env.images.head(photoPath);
      if (photoObject) {
        console.log(`找到照片: ${photoPath}`);
        return new Response(null, { 
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch (e) {
      console.log(`照片不存在: ${photoPath}`);
      // 继续检查其他文件
    }
    
    // 如果没有在R2中找到照片，检查数据库
    const stmt = env.data.prepare(`SELECT Id FROM Photos WHERE Id = ?`);
    const result = await stmt.bind(id).first();
    
    if (result) {
      console.log(`数据库中有照片记录，但R2中没有文件: ${id}`);
      // 数据库有记录但R2没有文件，返回204状态码
      return new Response(null, { 
        status: 204,  // No Content
        headers: {
          'Access-Control-Allow-Origin': '*',
          'X-Photo-Files-Missing': 'true'
        }
      });
    }
    
    // 数据库和R2都没有这张照片
    console.log(`照片不存在: ${id}`);
    return new Response(null, { 
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error(`检查照片存在性时出错: ${error}`);
    return new Response(null, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 获取R2存储桶中的对象数量和路径映射
async function handleGetR2ObjectCount(request, env) {
  try {
    console.log("开始获取R2存储桶中的照片数量");
    
    // 先检查photos目录
    let photosObjects = [];
    let photosToken = null;
    
    do {
      const photosList = await env.images.list({ 
        prefix: 'photos/', 
        limit: 1000, 
        cursor: photosToken 
      });
      
      if (photosList.objects && photosList.objects.length > 0) {
        photosObjects = [...photosObjects, ...photosList.objects];
      }
      
      photosToken = photosList.cursor;
    } while (photosToken);
    
    console.log(`在photos/目录中找到 ${photosObjects.length} 个文件`);
    
    // 提取photos目录中的照片ID
    const photoIds = new Set();
    for (const obj of photosObjects) {
      const key = obj.key;
      // 例如: photos/00001C0B1-5C71-495D-AA5D-11A20B3C3D63.jpg
      if (key.startsWith('photos/')) {
        const fileName = key.substring('photos/'.length);
        const photoId = fileName.split('.')[0]; // 去掉扩展名
        if (photoId) {
          photoIds.add(photoId);
        }
      }
    }
    
    // 检查thumbnails目录中的照片数 (只检查存在性,不遍历所有)
    let thumbnailsExist = false;
    try {
      const thumbnailCheck = await env.images.list({
        prefix: 'thumbnails/',
        limit: 1
      });
      thumbnailsExist = thumbnailCheck.objects && thumbnailCheck.objects.length > 0;
    } catch (e) {
      console.log("检查thumbnails目录出错:", e);
    }
    
    // 计算照片总数
    const uniquePhotoCount = photoIds.size;
    console.log(`提取出 ${uniquePhotoCount} 个唯一照片ID`);
    console.log(`thumbnails目录是否存在: ${thumbnailsExist}`);
    
    // 如果我们找不到照片，再尝试从数据库获取数量
    let dbPhotoCount = 0;
    if (uniquePhotoCount === 0) {
      try {
        const countStmt = env.data.prepare(`SELECT COUNT(*) as count FROM Photos`);
        const result = await countStmt.first();
        dbPhotoCount = result ? result.count : 0;
        console.log(`从数据库获取到照片数量: ${dbPhotoCount}`);
      } catch (e) {
        console.log("从数据库获取照片数量出错:", e);
      }
    }
    
    // 返回结果 (如果R2中没有照片但数据库有，使用数据库的数量)
    const finalCount = uniquePhotoCount > 0 ? uniquePhotoCount : dbPhotoCount;
    
    return jsonResponse({ 
      count: finalCount,
      r2Count: uniquePhotoCount,
      dbCount: dbPhotoCount,
      totalFiles: photosObjects.length,
      hasThumbnails: thumbnailsExist
    });
  } catch (error) {
    console.error('Failed to count R2 objects:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to count R2 objects: ' + error.message 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 处理Hello World请求
async function handleHelloWorld(request, env) {
  try {
    const timestamp = new Date().toISOString();
    return jsonResponse({
      message: "Hello World from TUI Portfolio API!",
      timestamp: timestamp,
      version: "1.0.0"
    });
  } catch (error) {
    console.error('Hello World error:', error);
    return new Response('Hello World failed: ' + error.message, { status: 500 });
  }
}
