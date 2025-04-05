// 验证相关的功能模块

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
      
      // 构建可能的文件路径
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
  
  // 获取R2存储桶中的对象数量
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
  
  // 验证特定照片记录的文件是否存在
  async function handleVerifyPhotoFiles(request, env, id) {
    try {
      // 从数据库获取照片记录
      const stmt = env.data.prepare(`
        SELECT Path, ThumbnailPath100, ThumbnailPath350
        FROM Photos 
        WHERE Id = ?
      `);
      const photo = await stmt.bind(id).first();
      
      if (!photo) {
        return jsonResponse({ 
          exists: false,
          reason: "photo_not_in_database" 
        });
      }
      
      // 检查三个文件是否都存在
      const results = {
        exists: true,
        original: false,
        thumbnail100: false,
        thumbnail350: false,
        missingFiles: []
      };
      
      // 检查原图
      try {
        if (photo.Path) {
          const originalExists = await env.images.head(photo.Path);
          results.original = !!originalExists;
          if (!results.original) {
            results.missingFiles.push(photo.Path);
            results.exists = false;
          }
        }
      } catch (e) {
        results.original = false;
        results.missingFiles.push(photo.Path);
        results.exists = false;
      }
      
      // 检查缩略图100
      try {
        if (photo.ThumbnailPath100) {
          const thumb100Exists = await env.images.head(photo.ThumbnailPath100);
          results.thumbnail100 = !!thumb100Exists;
          if (!results.thumbnail100) {
            results.missingFiles.push(photo.ThumbnailPath100);
            results.exists = false;
          }
        }
      } catch (e) {
        results.thumbnail100 = false;
        results.missingFiles.push(photo.ThumbnailPath100);
        results.exists = false;
      }
      
      // 检查缩略图350
      try {
        if (photo.ThumbnailPath350) {
          const thumb350Exists = await env.images.head(photo.ThumbnailPath350);
          results.thumbnail350 = !!thumb350Exists;
          if (!results.thumbnail350) {
            results.missingFiles.push(photo.ThumbnailPath350);
            results.exists = false;
          }
        }
      } catch (e) {
        results.thumbnail350 = false;
        results.missingFiles.push(photo.ThumbnailPath350);
        results.exists = false;
      }
      
      return jsonResponse(results);
    } catch (error) {
      console.error('Failed to verify photo files:', error);
      return jsonResponse({ 
        error: 'Failed to verify photo files: ' + error.message 
      }, 500);
    }
  }
  
  // 批量验证照片文件
  async function handleBatchVerifyPhotos(request, env) {
    try {
      const { ids } = await request.json();
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return jsonResponse({
          error: "Invalid request: ids should be a non-empty array"
        }, 400);
      }
      
      // 限制一次最多验证100张照片
      const photoIds = ids.slice(0, 100);
      const results = [];
      
      for (const id of photoIds) {
        const stmt = env.data.prepare(`
          SELECT Id, Path, ThumbnailPath100, ThumbnailPath350
          FROM Photos 
          WHERE Id = ?
        `);
        const photo = await stmt.bind(id).first();
        
        if (!photo) {
          results.push({
            id,
            exists: false,
            reason: "photo_not_in_database"
          });
          continue;
        }
        
        const fileResults = {
          id,
          exists: true,
          missingFiles: []
        };
        
        // 检查所有文件
        for (const path of [photo.Path, photo.ThumbnailPath100, photo.ThumbnailPath350]) {
          if (!path) continue;
          
          try {
            const exists = await env.images.head(path);
            if (!exists) {
              fileResults.exists = false;
              fileResults.missingFiles.push(path);
            }
          } catch (e) {
            fileResults.exists = false;
            fileResults.missingFiles.push(path);
          }
        }
        
        results.push(fileResults);
      }
      
      return jsonResponse({
        total: photoIds.length,
        results: results,
        summary: {
          success: results.filter(r => r.exists).length,
          failed: results.filter(r => !r.exists).length
        }
      });
    } catch (error) {
      console.error('Failed to batch verify photos:', error);
      return jsonResponse({ 
        error: 'Failed to batch verify photos: ' + error.message 
      }, 500);
    }
  }
  
  // 辅助函数：返回JSON响应
  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // 导出所有验证相关的处理函数
  export {
    handleGetMetadata,
    handleCheckFileIntegrity,
    handleGetPhotoCount,
    handleCheckPhotoExists,
    handleGetR2ObjectCount,
    handleVerifyPhotoFiles,
    handleBatchVerifyPhotos
  };