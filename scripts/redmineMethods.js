/**
 *  Функция для обновления списка задач	
 */
function getissues()
{
	var redmineUrl = settings.get("RedmineURL");
	var redmineToken = settings.get("RedmineToken");
	//Обращаемся к таблице, в которой хранится Дата последнего вызова
	var lastCall = db.find("last_call");
	//Если равно null, т.е. записи нет (функция не вызывалась или БД пересоздана)
	if(lastCall == null){
		//Выполняем запрос, используя фильтр, чтобы получить задачи с любым статусом и задачи,
		//отсортированные по приоритету (по возрастанию)
		var issues_result = fetch(redmineUrl+"/issues.json?status_id=*", {
			method: "GET",
			headers:{
				"X-Redmine-API-Key": redmineToken
			}
		});	
		//В переменную issues присваиваем результат запроса в формате JSON
		var issues = JSON.parse(issues_result.Data).issues;
		//Счетчик для подсчета новых задач
		var countInsert = 0;
		var countUpdate = 0;

		for(var i = 0; i< issues.length; i++)
		{			
			var issue = issues[i];
			//Переменные для связи полей "Назначено" и "Проект" с таблицами users и projects
			if(issues[i].assigned_to != null) {
			var rdevuser = db.findbyparams("users",{reccode: (issues[i].assigned_to.id).toString()});
			rdevuser = rdevuser[0].recid;}
			else rdevuser=null;
			var rdevproject = db.findbyparams("projects",{reccode: (issues[i].project.id).toString()});
			//Создаем переменную и заполняем ее поля полями из Redmine
			var rdevissue = {
				assigned_to_id: rdevuser,
				project_name: rdevproject[0].recid,			
				recname: issue.subject,
				due_date: issue.due_date,			
				status_issue: issue.status.id,
				priority_id: issue.priority.id,
				recdescription: issue.description,
				tracker_id: issue.tracker.id,
				project_id: issue.project.id,
				reccode: issue.id,
				reccreated: issue.created_on,
				updated: issue.updated_on,
				author: issue.author.name
			};
			//Если Дата завершения указана, то представляем её в формате ISO
			if(rdevissue.due_date != null){
				var date = new Date(rdevissue.due_date);
				rdevissue.due_date = date.toISOString();
			}
			//Смотрим по reccode, есть ли у нас запись в таблице, которая есть в issues[i]
			var issuesFind = db.findbyparams("issues",{reccode: (issues[i].id).toString()});

			if(issuesFind==null){
				//Вставляем запись в таблицу
				db.insert("issues", rdevissue);
				countInsert ++;
			}
			else{
				issuesFind[0].assigned_to_id = rdevuser;		
				issuesFind[0].recname= issue.subject;
				issuesFind[0].due_date= issue.due_date;		
				issuesFind[0].status_issue= issue.status.id;
				issuesFind[0].priority_id= issue.priority.id;
				issuesFind[0].recdescription= issue.description;
				issuesFind[0].tracker_id= issue.tracker.id;
				issuesFind[0].project_id= issue.project.id;
				issuesFind[0].reccreated= issue.created_on;
				issuesFind[0].updated= issue.updated_on;
				db.update("issues", issuesFind[0]);
			}
		}
		//Вызываем sql-функцию для рассчета веса и очереди задач у пользователей
		var usersFind = db.find("users");
		for(var i = 0; i< usersFind.length; i++)
		{	
			var assignedTo = usersFind[i].recid;	
			var sqlProcedureParams = {
				name: "recalculate_weight",
				parameters:[
					{
						name: "_lastname",
						value: assignedTo,
						type: "SysGUID",
					}
				]
			};
			db.execprocedure(sqlProcedureParams);
		}
		//Записываем дату вызова функции
		var toDay = new Date().toISOString();;
		lastCall = {
			lastcallgetissue: toDay,
		}
		db.insert("last_call",lastCall)
	}
	else{
		lastCallGetIssue = lastCall[0].lastcallgetissue;
		lastCallGetIssue = lastCallGetIssue.split('.')[0]+"Z";
		//Выполняем запрос, используя фильтр, чтобы получить задачи с любым статусом и задачи,
		//обновленные/созданные после последнего вызова функции
		var issues_result = fetch(redmineUrl+"/issues.json?status_id=*&updated_on=%3E%3D"+lastCallGetIssue, {
			method: "GET",
			headers:{
				"X-Redmine-API-Key": redmineToken
			}
		});	
		//В переменную issues присваиваем результат запроса в формате JSON
		var issues = JSON.parse(issues_result.Data).issues;

		//Счетчики для подсчета новых и обновленных задач
		var countInsert = 0;
		var countUpdate = 0;	
		for(var i=0; i<issues.length;i++){
			//Смотрим по reccode, есть ли у нас запись в таблице, которая есть в issues[i]
			var issuesFind = db.findbyparams("issues",{reccode: (issues[i].id).toString()});
			//Пользователь, на которого назначена задача
			if(issues[i].assigned_to != null) {
			var rdevuser = db.findbyparams("users",{reccode: (issues[i].assigned_to.id).toString()});
			rdevuser = rdevuser[0].recid;}
			else rdevuser=null;
			//Если в таблице нет такой записи
			if(issuesFind==null){
				var rdevproject = db.findbyparams("projects",{reccode: (issues[i].project.id).toString()});
				//Создаем переменную и заполняем ее поля полями из Redmine
				var rdevissue = {
					assigned_to_id: rdevuser,
					project_name: rdevproject[0].recid,			
					recname: issues[i].subject,
					due_date: issues[i].due_date,			
					status_issue: issues[i].status.id,
					priority_id: issues[i].priority.id,
					recdescription: issues[i].description,
					tracker_id: issues[i].tracker.id,
					project_id: issues[i].project.id,
					reccode: issues[i].id,
					reccreated: issues[i].created_on,
					updated: issues[i].updated_on,
					author: issues[i].author.name
				};
				//Если Дата завершения указана, то представляем её в формате ISO
					if(rdevissue.due_date != null){
					var date = new Date(rdevissue.due_date);
					rdevissue.due_date = date.toISOString();
				}
				db.insert("issues", rdevissue);
				countInsert ++;
				var sqlProcedureParams = {
					name: "recalculate_weight",
					parameters:[
						{
							name: "_lastname",
							value: rdevissue.assigned_to_id,
							type: "SysGUID",
						}
					]
				};
				db.execprocedure(sqlProcedureParams);
			}	//Если есть, то обновляем запись
			else{
				var x = issuesFind[0].priority_id[0].id;
				issuesFind[0].priority_id = issues[i].priority.id;
				issuesFind[0].assigned_to_id = rdevuser;		
				issuesFind[0].recname= issues[i].subject;
				issuesFind[0].due_date= issues[i].due_date;		
				issuesFind[0].status_issue= issues[i].status.id;
				issuesFind[0].priority_id= issues[i].priority.id;
				issuesFind[0].recdescription= issues[i].description;
				issuesFind[0].tracker_id= issues[i].tracker.id;
				issuesFind[0].project_id= issues[i].project.id;
				issuesFind[0].reccreated= issues[i].created_on;
				issuesFind[0].updated= issues[i].updated_on;
				db.update("issues", issuesFind[0]);
				countUpdate++;
				//Если в Redmine у задачи был изменен приоритет, то пересчитываем вес и очередь задач у пользователя
				if(x != issues[i].priority.id){
					var sqlProcedureParams = {
						name: "recalculate_weight",
						parameters:[
							{
								name: "_lastname",
								value: issuesFind[0].assigned_to_id,
								type: "SysGUID",
							}
						]
					};
					db.execprocedure(sqlProcedureParams);			
				}
			}
		}

		//Обновляем дату вызова функции
		var toDay = new Date().toISOString();
		lastCall[0].lastcallgetissue = toDay;
		db.update("last_call",lastCall[0])
	}
	//Выводим число полученных и обновленных задач
	if (countInsert == 0) return {
		success: false,
		message: "Отсутствуют новые задачи. " + "Обновлено задач: " + countUpdate
	}
	else return {
		success: false,
		message: "Получены новые задачи: " + countInsert + ". Обновлено задач: " + countUpdate
	}
}

/**  
 *	Функция получения/обновления проектов
 */
function getprojects()
{	
	var redmineUrl = settings.get("RedmineURL");
	var redmineToken = settings.get("RedmineToken");
	//Счетчики для подсчета новых и обновленных задач
	var countInsert = 0;
	var countUpdate = 0;
	//Делаем запрос для получения проектов из Redmine
	var projects_result = fetch(redmineUrl+"/projects.json",{
		method: "GET",
			headers:{
			"X-Redmine-API-Key": redmineToken
			}		
	});
	//В переменную projects присваиваем результат запроса в формате JSON			
	var projects = JSON.parse(projects_result.Data).projects;
	
	for(var i =0; i<projects.length;i++)
	{
		var project = projects[i];
		//Создаем переменную и заполняем ее поля полями из Redmine
		var rdevproject = {
			recname: project.name,
			recdescription: project.description,
			reccode: project.id,
			reccreated: project.created_on,
			updated: project.updated_on,
			is_public: project.is_public,
			status_project: project.status,
			rgt: project.rgt,
			inherit_members: project.inherit_members,
			identifier: project.identifier,
			homepage: project.homepage,
			parent_id: project.parent_id			
			};
		//Находим в таблице Projects проекты с таким же reccode	
		var projectsFind = db.findbyparams("projects",{reccode: (project.id).toString()});
		//Если такой записи нет, то вставляем ее
		if(projectsFind == null){
			db.insert("projects", rdevproject);
			countInsert++;
		}
		//Если такая запись есть и она была обновлена в Redmine, то обновляем ее
		else if(rdevproject.updated > projectsFind[0].updated){
			projectsFind[0].recname = rdevproject.recname;
			projectsFind[0].recdescription = rdevproject.recdescription;
			projectsFind[0].updated = rdevproject.updated;
			projectsFind[0].is_public = rdevproject.is_public;
			projectsFind[0].status_project = rdevproject.status_project;
			projectsFind[0].identifier = rdevproject.identifier;
			db.update("projects", projectsFind[0]);
			countUpdate++;
		}
		getmemberships(rdevproject.reccode);
	}
	//Выводим число новых и обновленных задач
	if (countInsert == 0) return {
			success: false,
			message: "Отсутствуют новые проекты. " + "Обновлено: " + countUpdate
		}
	else return {
			success: false,
			message: "Получено новых проектов: " + countInsert + ". Обновлено: " + countUpdate		          
	}
}

/** 
 *  Функция для получения пользователей проекта
 *	@param {*} projectId - id синхронизируемого проекта
 */
function getmemberships(projectId)
{
	var redmineUrl = settings.get("RedmineURL");
	var redmineToken = settings.get("RedmineToken");
	var users_result = fetch(redmineUrl+"/projects/"+projectId+"/memberships.json", {
		method: "GET",
		headers:{
			"X-Redmine-API-Key": redmineToken
		}
	});
	//В переменную users присваиваем результат запроса в формате JSON
	var users = JSON.parse(users_result.Data).memberships;
	for (var i =0; i<users.length;i++){
		var user = users[i].user;
		//Находим в таблице Users задачи с таким же reccode		
		var usersFind = db.findbyparams("users",{reccode: (user.id).toString()});
		//Если такой записи нет, то вставляем ее
		if(usersFind == null){
			//Создаем переменную и заполняем ее поля полями из Redmine
			var rdevuser = {
				reccode: user.id,
				login: user.name,
				lastname: user.name,
			};
			//Добавляем запись в таблицу
			db.insert("users", rdevuser);
		}
		else{
			if(usersFind[0].login != user.name){
				usersFind[0].login = user.name;
				db.update("users", usersFind[0]);
			}
		}
	}
}


/** 
 *	Функция для получения/обновления списка пользователей
 */
function getusers()
{	
	var redmineUrl = settings.get("RedmineURL");
	var redmineToken = settings.get("RedmineToken");
	//Счетчики для подсчета новых и обновленных задач
	var countInsert = 0;
	var countUpdate = 0;

	var users_result = fetch(redmineUrl+"/users.json", {
		method: "GET",
		headers:{
			"X-Redmine-API-Key": redmineToken
		}
	});
	//В переменную users присваиваем результат запроса в формате JSON
	var users = JSON.parse(users_result.Data).users;
	for(var i =0; i<users.length;i++)
	{
		var user = users[i];
		//Создаем переменную и заполняем ее поля полями из Redmine
		var rdevuser = {
			reccode: user.id,
			login: user.login,
			firstname: user.firstname,
			lastname: user.lastname,
			status_us: user.status,
			reccreated: user.created_on,
			updated: user.updated_on,
			type: user.type,
			identity_url: user.identity_url,
			mail_notification: user.mail		
		};
		//Находим в таблице Users задачи с таким же reccode		
		var usersFind = db.findbyparams("users",{reccode: (user.id).toString()});
		//Если такой записи нет, то вставляем ее
		if(usersFind == null){
			db.insert("users", rdevuser);
			countInsert++;
		}
	}
	//Выводим число новых и обновленных задач
	if (countInsert == 0) 
		return {
			success: false,
			message: "Отсутствуют новые записи. " + "Обновлено: " + countUpdate
		}
	else 
		return {
			success: false,
			message: "Получено новых записей: " + countInsert + ". Обновлено: " + countUpdate		          
		}
}

/**
 * Функция для поднятия задачи в очереди на одну позицию
 * @param {*} params - объект, переданный из выбранной строки таблицы issues, содержащий recid записи.
 */
function priority_up(params)
{
	//Находим запись по params.recid	
	var entry = db.findbyrecid("issues", params.recid);	
	if(entry.status_issue == 5) return {
		success: false,
		message: "Данная задача закрыта"
	};
	if(entry.priority == 1) return {
		success: false,
		message: "У задачи максимально возможный приоритет"
	};	
	//Находим все записи, назначнные на данного пользователя
	var issuesAssigned = db.findbyparams("issues", {assigned_to_id: entry.assigned_to_id});
	//Находим у данного пользователя задачу в очереди перед выбранной
	var issuesNewPriority = issuesAssigned.filter(function(a){
		return a.priority == entry.priority-1;
	});
	//Если пытаемся поставить задачу впереди задачи с более высоким приоритетом
	if(issuesNewPriority[0].priority_id[0].id>entry.priority_id[0].id){
		return {
			success: false,
			message: 'Вы пытаетесь задачу с приоритетом "'+entry.priority_id[0].value+'" поставить в очереди перед задачей с приоритетом "'+issuesNewPriority[0].priority_id[0].value+'". Сначала измените приоритет в Redmine'
		};	
	}
	//Если хотим вторую задачу поставить первой, то меняем их вес местами
	if(issuesNewPriority[0].priority==1){
		var x = issuesNewPriority[0].weight;
		issuesNewPriority[0].weight = entry.weight;
		issuesNewPriority[0].priority_id = issuesNewPriority[0].priority_id[0].id
		issuesNewPriority[0].status_issue = issuesNewPriority[0].status_issue[0].id;
		issuesNewPriority[0].tracker_id = issuesNewPriority[0].tracker_id[0].id;
		db.update("issues", issuesNewPriority[0]);
		//В вес выбранной задачи записываем х
		entry.weight = x;	
	}//Иначе находим соседнюю задачу перед issuesNewPriority в очереди запись 
	else{
		var issuesNewPriority1 = issuesAssigned.filter(function(a){
			return a.priority == issuesNewPriority[0].priority-1;
		});
		entry.weight = (issuesNewPriority[0].weight+issuesNewPriority1[0].weight)/2;
	}
	//Обновляем выбранную запись
	entry.priority_id = entry.priority_id[0].id;
	entry.status_issue = entry.status_issue[0].id;
	entry.tracker_id = entry.tracker_id[0].id;
	db.update("issues", entry);
	//Пересчитаем очередь выполнения у пользователя
	var sqlProcedureParams = {
		name: "recalculate_priority",
		parameters:[
			{
				name: "_lastname",
				value: entry.assigned_to_id,
				type: "SysGUID",
			}
		]
	};
	db.execprocedure(sqlProcedureParams);	
}

/** 
 *  Функция понижения задачи в очереди на одну позицию
 *	@param {*} params - объект, переданный из выбранной строки таблицы issues, содержащий recid записи.
 */
function priority_down(params)
{
	//1.Находим запись по params.recid	
	var entry = db.findbyrecid("issues", params.recid);
	//Если пытаемся изменить приоритет закрытой задачи
	if(entry.status_issue == 5) return {
		success: false,
		message: "Данная задача закрыта"
	};	
	//Находим все открытые задачи, назначнные на данного пользователя
	var issuesAssigned = db.findbyparams("issues", {assigned_to_id: entry.assigned_to_id});
	issuesAssigned = issuesAssigned.filter(function(a){return a.weight >0;	});
	if(entry.priority == issuesAssigned.length)
	return {
		success: false,
		message: "У задачи минимально возможный приоритет"
	};
	//Находим у данного пользователя задачу после выбранной
	var issuesNewPriority = issuesAssigned.filter(function(a){
		return a.priority == entry.priority+1;
	});
	//Если пытаемся поставить задачу после задачи с более низким приоритетом
	if(issuesNewPriority[0].priority_id[0].id<entry.priority_id[0].id){
		return {
			success: false,
			message: 'Вы пытаетесь задачу с приоритетом "'+entry.priority_id[0].value+'" поставить в очереди после задачи с приоритетом "'+issuesNewPriority[0].priority_id[0].value+'". Сначала измените приоритет в Redmine'
		};	
	}
	//Записываес ее вес в переменную х
	var x = issuesNewPriority[0].weight;
	//Пересчитываем ее вес, чтобы ее очередь повысилась на 1
	issuesNewPriority[0].weight = (x+entry.weight)/2;
	issuesNewPriority[0].status_issue = issuesNewPriority[0].status_issue[0].id;
	issuesNewPriority[0].tracker_id = issuesNewPriority[0].tracker_id[0].id;
	issuesNewPriority[0].priority_id = issuesNewPriority[0].priority_id[0].id
	db.update("issues", issuesNewPriority[0]);
	//В вес выбранной задачи записываем х
	entry.weight = x;
	entry.priority_id = entry.priority_id[0].id;
	entry.status_issue = entry.status_issue[0].id;
	entry.tracker_id = entry.tracker_id[0].id;
	db.update("issues", entry);
	//Пересчитаем очередь выполнения у пользователя
	var sqlProcedureParams = {
		name: "recalculate_priority",
		parameters:[
			{
				name: "_lastname",
				value: entry.assigned_to_id,
				type: "SysGUID",
			}
		]
	};
	db.execprocedure(sqlProcedureParams);	
}

/** Функция для назначения очереди
 * 	@param {*} params - объект, переданный из выбранной строки таблицы issues, содержащий recid и priority записи.
 */
function assign_to_priority(params)
{
	//Найти запись по params.recid
	var entry = db.findbyrecid("issues", params.recid);
	if(entry.status_issue == 5) return {
		success: false,
		message: "Данная задача закрыта"
	};
	//Присвоить переменной текущий приоритет задачи
	var first_priority = entry.priority;
    //Новый приоритет задачи		
	var new_priority = +params.priority;
	//Находим все открытые задачи, назначнные на данного пользователя
	var issuesAssigned = db.findbyparams("issues", {assigned_to_id: entry.assigned_to_id});
	issuesAssigned = issuesAssigned.filter(function(a){return a.status_issue != 5;	});
	//Проверка на корректность значения приоритета
	if(new_priority<1 | new_priority>issuesAssigned.length)
		return {
			success: false,
			message: "Введено неверное значение"
		};
	//Находим запись с очередью, которую хотим назначить
	var issueNewPriority = issuesAssigned.filter(function(a){return a.priority == new_priority;	});

	//В зависимости от того какую очередь хотим назначить (повысить или понизить)
	//будут выводится разные сообщения и алгоритм нахождения задач, вес которых будет учавствовать в расчете

	//Если продвигаем вперед по очереди
	if(new_priority < first_priority){
		//Если приоритеты у задач разные выводим сообщение, выполнение функции завершается
		if(issueNewPriority[0].priority_id[0].id!=entry.priority_id[0].id){
			return {
				success: false,
				message: 'Вы пытаетесь задачу с приоритетом "'+entry.priority_id[0].value+'" поставить в очереди перед задачей с приоритетом "'+issueNewPriority[0].priority_id[0].value+'". Сначала измените приоритет в Redmine'
			};	
		}
		//Если назначаем задаче первую очередь, присваиваем вес выбранной задаче на единицу больше
		//чем у задачи, которая была первой в очереди
		if(issueNewPriority[0].priority == 1){
			entry.weight = issueNewPriority[0].weight+1;
		}
		//В другом случае находим запись в очереди перед issueNewPriority, чтобы
		//рассчитать вес выбранной задачи
		else{
		var issueNewPriority1 = issuesAssigned.filter(function(a){return a.priority == issueNewPriority[0].priority-1});
		//Рассчитываем вес выбранной задачи
		entry.weight = (issueNewPriority[0].weight+issueNewPriority1[0].weight)/2;
		}
	}
	//Если продвигаем назад по очереди
	if(new_priority > first_priority){
		//Если приоритеты у задач разные выводим сообщение, выполнение функции завершается
		if(issueNewPriority[0].priority_id[0].id!=entry.priority_id[0].id){
			return {
				success: false,
				message: 'Вы пытаетесь задачу с приоритетом "'+entry.priority_id[0].value+'" поставить в очереди после задачи с приоритетом "'+issueNewPriority[0].priority_id[0].value+'". Сначала измените приоритет в Redmine'
			};	
		}	
		//Если назначаем задаче последнюю очередь
		if(issueNewPriority[0].priority == issuesAssigned.length){
			entry.weight = (0+issueNewPriority[0].weight)/2;
		}
		//В другом случае находим запись в очереди после issueNewPriority, чтобы
		//рассчитать вес выбранной задачи
		else{
			var issueNewPriority1 = issuesAssigned.filter(function(a){return a.priority == issueNewPriority[0].priority+1});
			//Рассчитываем вес выбранной задачи
			entry.weight = (issueNewPriority[0].weight+issueNewPriority1[0].weight)/2;
		}	
	}
	//Обновляем выбранную запись
	entry.status_issue = entry.status_issue[0].id;
	entry.tracker_id = entry.tracker_id[0].id;
	entry.priority_id = entry.priority_id[0].id;
	db.update("issues", entry);
	//Пересчитываем очередность у пользователя
	var sqlProcedureParams = {
		name: "recalculate_priority",
		parameters:[
			{
				name: "_lastname",
				value: entry.assigned_to_id,
				type: "SysGUID",
			}
		]
	};
	db.execprocedure(sqlProcedureParams);	
}

/** Функция закрытия задачи 
*	(пока в rdev только отображаем то, что есть в Redmine. Поэтому данная функция не добавлена в функционал rdev)
*/
function close_issue(params)
{
	//Находим запись по params.recid
	var entry = db.findbyrecid("issues", params.recid);
	//Присваиваем в status_issue пять (соответствует статусу "Закрыта")
	entry.status_issue = 5;
	entry.tracker_id = entry.tracker_id[0].id;
	//Вес записи зануляем 
	entry.weight = 0;
	entry.priority_id = entry.priority_id[0].id;
	entry.priority = null;
	db.update("issues", entry);
	//Пересчитываем очередность выполнения задач у пользователя
	var sqlProcedureParams = {
		name: "recalculate_priority",
		parameters:[
			{
				name: "_lastname",
				value: entry.assigned_to_id,
				type: "SysGUID",
			}
		]
	};
	db.execprocedure(sqlProcedureParams);	
}
//Функция для переназначения задачи (ошибка при отображении поля "Назначено")
function reassign_issue(params){
/*	var entry = db.findbyrecid("issues", params.recid);
	var sqlProcedureParams = {
		name: "recalculate_priority",
		parameters:[
			{
				name: "_lastname",
				value: entry.assigned_to_id,
				type: "SysGUID",
			}
		]
	};
	db.execprocedure(sqlProcedureParams);	
*/
return entry;

}
